/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";
import {
  agreementAlreadyExists,
  delegationNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  tenantIsNotTheDelegateConsumer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements test", () => {
  const mockAgreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);
  const defaultBody: agreementApi.AgreementPayload = {
    eserviceId: mockAgreement.eserviceId,
    descriptorId: mockAgreement.descriptorId,
  };

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.createAgreement = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    body: agreementApi.AgreementPayload = defaultBody
  ) =>
    request(api)
      .post("/agreements")
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
      expect(res.body).toEqual(apiResponse);
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
    {
      error: notLatestEServiceDescriptor(mockAgreement.descriptorId),
      expectedStatus: 400,
    },
    {
      error: descriptorNotInExpectedState(
        mockAgreement.eserviceId,
        mockAgreement.descriptorId,
        [descriptorState.draft]
      ),
      expectedStatus: 400,
    },
    {
      error: missingCertifiedAttributesError(
        mockAgreement.descriptorId,
        mockAgreement.consumerId
      ),
      expectedStatus: 400,
    },
    { error: eServiceNotFound(mockAgreement.eserviceId), expectedStatus: 400 },
    {
      error: delegationNotFound(generateId<DelegationId>()),
      expectedStatus: 400,
    },
    { error: tenantNotFound(generateId()), expectedStatus: 400 },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
    {
      error: agreementAlreadyExists(
        mockAgreement.consumerId,
        mockAgreement.eserviceId
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.createAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { ...defaultBody, eserviceId: undefined } },
    { body: { ...defaultBody, descriptorId: undefined } },
    { body: { ...defaultBody, eserviceId: "invalid" } },
    { body: { ...defaultBody, descriptorId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as agreementApi.AgreementPayload);
    expect(res.status).toBe(400);
  });
});
