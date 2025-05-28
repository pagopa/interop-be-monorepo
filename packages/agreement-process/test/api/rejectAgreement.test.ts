/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgreementId,
  DelegationId,
  agreementState,
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
  agreementNotFound,
  agreementNotInExpectedState,
  tenantIsNotTheDelegateProducer,
  tenantIsNotTheProducer,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements/{agreementId}/reject test", () => {
  const mockAgreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);
  const defaultBody: agreementApi.AgreementRejectionPayload = {
    reason: "Mock reason for rejection",
  };

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.rejectAgreement = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    body: agreementApi.AgreementRejectionPayload = defaultBody
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/reject`)
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
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.draft
      ),
      expectedStatus: 400,
    },
    { error: tenantIsNotTheProducer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateProducer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.rejectAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" as AgreementId },
    { body: {} },
    { body: { reason: 1 } },
    { body: { reason: "too short" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        agreementId,
        body as agreementApi.AgreementRejectionPayload
      );
      expect(res.status).toBe(400);
    }
  );
});
