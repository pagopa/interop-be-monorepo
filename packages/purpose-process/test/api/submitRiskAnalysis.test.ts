/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Purpose, PurposeId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  AuthRole,
  authRole,
  unexpectedFieldError,
} from "pagopa-interop-commons";
import { purposeApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  purposeNotFound,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotSubmittable,
  submitNotAllowedForReviewMode,
  tenantIsNotTheConsumer,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/submit test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata(mockPurpose);

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose)
  );

  const defaultBody: purposeApi.RiskAnalysisSubmissionSeed = {
    riskAnalysisForm: {
      version: "3.0",
      answers: {
        purpose: ["INSTITUTIONAL"],
        institutionalPurpose: ["test purpose description"],
        personalDataTypes: ["OTHER"],
        otherPersonalDataTypes: ["other data type"],
        legalBasis: ["LEGAL_OBLIGATION"],
        legalObligationReference: ["some law ref"],
        knowsDataQuantity: ["NO"],
        deliveryMethod: ["ANONYMOUS"],
        ppiIrreversibleAdditionalTechniques: ["CRYPTOGRAPHIC_HASH"],
        doneDpia: ["NO"],
        dataRetentionPeriod: ["24"],
        purposePursuit: ["MERE_CORRECTNESS"],
        checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
        usesThirdPartyData: ["NO"],
        personalData: ["YES"],
      },
    },
  };

  beforeEach(() => {
    purposeService.submitRiskAnalysis = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.RiskAnalysisSubmissionSeed = defaultBody
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/riskAnalysis/submit`)
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
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    { error: reviewerWorkflowNotFound(mockPurpose.id), expectedStatus: 404 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: reviewerWorkflowNotSubmittable(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: submitNotAllowedForReviewMode(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: riskAnalysisValidationFailed([
        unexpectedFieldError("unexpectedField"),
      ]),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.submitRiskAnalysis = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { riskAnalysisForm: {} } },
    {
      body: {
        riskAnalysisForm: { version: "", answers: {} },
      },
    },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as purposeApi.RiskAnalysisSubmissionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
