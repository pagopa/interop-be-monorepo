/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PurposeId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  purposeNotFound,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotInPendingSignatureState,
  requesterIsNotTheSigner,
  rejectNotAllowedInCurrentMode,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/reject test", () => {
  const mockPurpose = getMockPurpose();

  beforeEach(() => {
    purposeService.rejectRiskAnalysis = vi.fn().mockResolvedValue({
      data: { purpose: mockPurpose, isRiskAnalysisValid: true },
      metadata: { version: 1 },
    });
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: { rejectionReason: string } = {
      rejectionReason: "This risk analysis is incomplete and needs revision",
    }
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/riskAnalysis/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it.each(
    Object.values(authRole).filter(
      (role) => role !== authRole.REVIEWER_ROLE
    )
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
      error: reviewerWorkflowNotInPendingSignatureState(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: requesterIsNotTheSigner(mockPurpose.id),
      expectedStatus: 403,
    },
    {
      error: rejectNotAllowedInCurrentMode(mockPurpose.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.rejectRiskAnalysis = vi.fn().mockRejectedValue(error);
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
