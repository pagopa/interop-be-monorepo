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
  editNotAllowedForReviewMode,
  purposeNotFound,
  requesterIsNotDesignatedReviewer,
  reviewerWorkflowNotEditable,
  reviewerWorkflowNotFound,
  riskAnalysisValidationFailed,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";

describe("API PUT /purposes/{purposeId}/riskAnalysis/form test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata(mockPurpose);
  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose)
  );
  const defaultBody: purposeApi.RiskAnalysisFormSeed = {
    version: "3.0",
    answers: {
      purpose: ["INSTITUTIONAL"],
      institutionalPurpose: ["MyPurpose"],
    },
  };

  beforeEach(() => {
    purposeService.editRiskAnalysisForm = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.RiskAnalysisFormSeed = defaultBody
  ) =>
    request(api)
      .put(`/purposes/${purposeId}/riskAnalysis/form`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.REVIEWER_ROLE];

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
    {
      error: reviewerWorkflowNotFound(mockPurpose.id),
      expectedStatus: 404,
    },
    {
      error: riskAnalysisValidationFailed([
        unexpectedFieldError("unexpectedField"),
      ]),
      expectedStatus: 400,
    },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: editNotAllowedForReviewMode(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: reviewerWorkflowNotEditable(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: requesterIsNotDesignatedReviewer(mockPurpose.id),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.editRiskAnalysisForm = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if purposeId is invalid", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });

  it.each([
    { body: {} },
    { body: { version: 1, answers: {} } },
    { body: { version: "3.0" } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(
      token,
      mockPurpose.id,
      body as unknown as purposeApi.RiskAnalysisFormSeed
    );
    expect(res.status).toBe(400);
  });
});
