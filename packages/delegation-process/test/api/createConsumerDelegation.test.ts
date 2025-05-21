/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  Delegation,
  EService,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, delegationService } from "../vitest.api.setup.js";
import { delegationToApiDelegation } from "../../src/model/domain/apiConverter.js";
import {
  delegationAlreadyExists,
  delegationRelatedAgreementExists,
  delegatorAndDelegateSameIdError,
  eserviceNotConsumerDelegable,
  eserviceNotFound,
  originNotCompliant,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /consumer/delegations test", () => {
  const mockDelegator = { ...getMockTenant(), name: "Comune di Burione" };
  const mockEService: EService = getMockEService();
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });
  const defaultBody: delegationApi.DelegationSeed = {
    delegateId: mockDelegator.id,
    eserviceId: mockEService.id,
  };

  const serviceResponse = getMockWithMetadata(mockDelegation);
  const apiDelegation = delegationApi.Delegation.parse(
    delegationToApiDelegation(mockDelegation)
  );

  beforeEach(() => {
    delegationService.createConsumerDelegation = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    body: delegationApi.DelegationSeed = defaultBody
  ) =>
    request(api)
      .post("/consumer/delegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDelegation);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: eserviceNotFound(mockEService.id), expectedStatus: 400 },
    { error: tenantNotFound(mockDelegator.id), expectedStatus: 400 },
    { error: delegatorAndDelegateSameIdError(), expectedStatus: 400 },
    {
      error: eserviceNotConsumerDelegable(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: originNotCompliant(mockDelegator, "Delegator"),
      expectedStatus: 403,
    },
    {
      error: tenantNotAllowedToDelegation(
        mockDelegator.id,
        "DelegatedConsumer"
      ),
      expectedStatus: 403,
    },
    {
      error: delegationAlreadyExists(
        mockDelegator.id,
        mockEService.id,
        "DelegatedConsumer"
      ),
      expectedStatus: 409,
    },
    {
      error: delegationRelatedAgreementExists(
        generateId<AgreementId>(),
        mockEService.id,
        mockDelegator.id
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      delegationService.createConsumerDelegation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { delegateId: mockDelegator.id } },
    { body: { eserviceId: mockEService.id } },
    { body: { delegateId: "invalid", eserviceId: mockEService.id } },
    { body: { delegateId: mockDelegator.id, eserviceId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as delegationApi.DelegationSeed);
    expect(res.status).toBe(400);
  });
});
