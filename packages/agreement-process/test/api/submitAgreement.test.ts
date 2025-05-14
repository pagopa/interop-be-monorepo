/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgreementId,
  DelegationId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementSubmissionFailed,
  consumerWithNotValidEmail,
  contractAlreadyExists,
  descriptorNotInExpectedState,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements/{agreementId}/submit test", () => {
  const mockAgreement = getMockAgreement();

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.submitAgreement = vi.fn().mockResolvedValue(mockAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: notLatestEServiceDescriptor(generateId()), expectedStatus: 400 },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.draft
      ),
      expectedStatus: 400,
    },
    {
      error: consumerWithNotValidEmail(mockAgreement.id, generateId()),
      expectedStatus: 400,
    },
    { error: agreementSubmissionFailed(mockAgreement.id), expectedStatus: 400 },
    {
      error: missingCertifiedAttributesError(generateId(), generateId()),
      expectedStatus: 400,
    },
    {
      error: descriptorNotInExpectedState(generateId(), generateId(), []),
      expectedStatus: 400,
    },
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    { error: organizationIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: organizationIsNotTheDelegateConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    {
      error: agreementAlreadyExists(generateId(), generateId()),
      expectedStatus: 409,
    },
    { error: contractAlreadyExists(mockAgreement.id), expectedStatus: 409 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.submitAgreement = vi.fn().mockRejectedValue(error);
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
