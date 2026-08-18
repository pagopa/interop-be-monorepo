/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/sign test", () => {
  const mockPurposeId: PurposeId = generateId();

  beforeEach(() => {
    config.featureFlagNewOperators = true;
    clients.purposeProcessClient.signRiskAnalysis = vi
      .fn()
      .mockResolvedValue({ id: mockPurposeId });
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/sign`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([{ purposeId: "invalid" as PurposeId }])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId }) => {
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(token, purposeId);
      expect(res.status).toBe(400);
    }
  );
});
