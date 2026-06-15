/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/reject test", () => {
  const mockPurposeId: PurposeId = generateId();
  const defaultBody: bffApi.RiskAnalysisRejectionSeed = {
    rejectionReason: "This risk analysis is incomplete and needs revision",
  };

  beforeEach(() => {
    clients.purposeProcessClient.rejectRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisRejectionSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

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
        body as bffApi.RiskAnalysisRejectionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
