/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/assign test", () => {
  const mockPurposeId: PurposeId = generateId();
  const defaultBody: bffApi.RiskAnalysisAssignmentSeed = {
    reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
    reviewerIds: [generateId()],
  };

  beforeEach(() => {
    clients.purposeProcessClient.assignRiskAnalysisReviewer = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisAssignmentSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/assign`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { reviewMode: "INVALID_MODE", reviewerIds: [generateId()] } },
    { body: { reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS", reviewerIds: [] } },
    {
      body: {
        reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
        reviewerIds: ["not-a-uuid"],
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
        body as bffApi.RiskAnalysisAssignmentSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
