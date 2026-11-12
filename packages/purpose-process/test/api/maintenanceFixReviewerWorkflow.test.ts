/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  purposeNotFound,
  riskAnalysisReviewModeNotFound,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API POST /maintenance/purposes/{purposeId}/riskAnalysis/reviewerWorkflow/fix test", () => {
  const mockPurpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata(mockPurpose);

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose)
  );

  beforeEach(() => {
    purposeService.fixReviewerWorkflow = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .post(
        `/maintenance/purposes/${purposeId}/riskAnalysis/reviewerWorkflow/fix`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 with the updated purpose for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
    expect(res.headers["x-metadata-version"]).toBe(
      serviceResponse.metadata.version.toString()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    purposeNotFound(mockPurpose.id),
    riskAnalysisReviewModeNotFound(mockPurpose.id),
  ])("Should return 404 for $code", async (error) => {
    purposeService.fixReviewerWorkflow = vi.fn().mockRejectedValue(error);

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed invalid purposeId", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });
});
