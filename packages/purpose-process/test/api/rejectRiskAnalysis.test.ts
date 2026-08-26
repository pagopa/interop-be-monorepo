/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { Purpose, PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  purposeNotFound,
  reviewerWorkflowNotFound,
  rejectNotAllowedInCurrentMode,
  reviewerWorkflowNotInSubmittedState,
  requesterIsNotDesignatedReviewer,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/reject test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata(mockPurpose);
  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose)
  );
  const defaultBody: purposeApi.RiskAnalysisRejectionSeed = {
    rejectionReason: "This risk analysis is incomplete and needs revision",
  };

  beforeEach(() => {
    purposeService.rejectRiskAnalysis = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.RiskAnalysisRejectionSeed = defaultBody
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/riskAnalysis/reject`)
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
      error: reviewerWorkflowNotInSubmittedState(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: requesterIsNotDesignatedReviewer(mockPurpose.id),
      expectedStatus: 403,
    },
    {
      error: tenantIsNotTheConsumer(generateId()),
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

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { rejectionReason: 1 } },
    { body: { rejectionReason: "short" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as purposeApi.RiskAnalysisRejectionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
