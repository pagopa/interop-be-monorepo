/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, agreementState, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  missingCertifiedAttributesError,
  noNewerDescriptor,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
  publishedDescriptorNotFound,
} from "../../src/model/domain/errors.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";

describe("API POST /agreements/{agreementId}/upgrade test", () => {
  const mockAgreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/upgrade`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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
      error: missingCertifiedAttributesError(
        mockAgreement.descriptorId,
        mockAgreement.consumerId
      ),
      expectedStatus: 400,
    },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.active
      ),
      expectedStatus: 400,
    },
    {
      error: publishedDescriptorNotFound(mockAgreement.eserviceId),
      expectedStatus: 400,
    },
    {
      error: noNewerDescriptor(
        mockAgreement.eserviceId,
        mockAgreement.descriptorId
      ),
      expectedStatus: 400,
    },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.upgradeAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{ agreementId: "invalid" as AgreementId }])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId);
      expect(res.status).toBe(400);
    }
  );
});
