/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import {
  AuthRole,
  authRole,
  unexpectedFieldError,
} from "pagopa-interop-commons";
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
  missingRiskAnalysis,
  purposeMetadataVersionMismatch,
  purposeNotFound,
  riskAnalysisValidationFailed,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotInSignableState,
  requesterIsNotDesignatedReviewer,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/sign test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata(mockPurpose);
  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose)
  );
  const defaultBody: purposeApi.RiskAnalysisSignSeed = {
    metadataVersionToSign: 1,
  };

  beforeEach(() => {
    purposeService.signRiskAnalysis = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.RiskAnalysisSignSeed = defaultBody
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/riskAnalysis/sign`)
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
      expect(purposeService.signRiskAnalysis).toHaveBeenCalledWith(
        mockPurpose.id,
        defaultBody,
        expect.anything()
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
      error: reviewerWorkflowNotInSignableState(mockPurpose.id),
      expectedStatus: 409,
    },
    {
      error: purposeMetadataVersionMismatch(mockPurpose.id, 0, 1),
      expectedStatus: 409,
    },
    {
      error: requesterIsNotDesignatedReviewer(mockPurpose.id),
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

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { metadataVersionToSign: -1 } },
    { body: { metadataVersionToSign: 1.5 } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as purposeApi.RiskAnalysisSignSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
