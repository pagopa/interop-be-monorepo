/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delegationApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockDelegation,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  EService,
  TenantId,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";

import { api, delegationService } from "../vitest.api.setup.js";
import { delegationToApiDelegation } from "../../src/model/domain/apiConverter.js";
import {
  delegationAlreadyExists,
  delegatorAndDelegateSameIdError,
  differentEServiceProducer,
  eserviceNotFound,
  originNotCompliant,
  tenantNotAllowedToDelegation,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /producer/delegations test", () => {
  const mockDelegator = { ...getMockTenant(), name: "Comune di Burione" };
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
  });
  const mockEService: EService = getMockEService();
  const defaultBody: delegationApi.DelegationSeed = {
    delegateId: mockDelegator.id,
    eserviceId: mockEService.id,
  };

  const apiDelegation = delegationApi.Delegation.parse(
    delegationToApiDelegation(mockDelegation)
  );

  delegationService.createProducerDelegation = vi.fn().mockResolvedValue({
    data: mockDelegation,
    metadata: { version: 0 },
  });

  const makeRequest = async (
    token: string,
    body: delegationApi.DelegationSeed = defaultBody
  ) =>
    request(api)
      .post("/producer/delegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDelegation);
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
    { error: differentEServiceProducer(mockDelegator.id), expectedStatus: 403 },
    {
      error: delegationAlreadyExists(
        mockDelegator.id,
        mockEService.id,
        "DelegatedConsumer"
      ),
      expectedStatus: 409,
    },
    {
      error: delegationAlreadyExists(
        generateId<TenantId>(),
        mockEService.id,
        "DelegatedProducer"
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      delegationService.createProducerDelegation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {} as delegationApi.DelegationSeed);
    expect(res.status).toBe(400);
  });
});
