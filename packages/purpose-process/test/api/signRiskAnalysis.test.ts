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
  missingRiskAnalysis,
  purposeNotFound,
  riskAnalysisValidationFailed,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotInSubmittedState,
  requesterIsNotTheSigner,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/sign test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata({
    purpose: mockPurpose,
    isRiskAnalysisValid: true,
  });
  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose)
  );

  beforeEach(() => {
    purposeService.signRiskAnalysis = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/riskAnalysis/sign`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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
      error: reviewerWorkflowNotInSubmittedState(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: requesterIsNotTheSigner(mockPurpose.id),
      expectedStatus: 403,
    },
    {
      error: missingRiskAnalysis(mockPurpose.id),
      expectedStatus: 400,
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
      purposeService.signRiskAnalysis = vi.fn().mockRejectedValue(error);
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
});
