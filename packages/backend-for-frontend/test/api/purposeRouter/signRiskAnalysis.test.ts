/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
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
  const defaultBody: bffApi.RiskAnalysisSignSeed = {
    metadataVersionToSign: 1,
  };

  beforeEach(() => {
    config.featureFlagNewOperators = true;
    clients.purposeProcessClient.signRiskAnalysis = vi
      .fn()
      .mockResolvedValue({ id: mockPurposeId });
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisSignSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/sign`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(clients.purposeProcessClient.signRiskAnalysis).toHaveBeenCalledWith(
      defaultBody,
      expect.objectContaining({ params: { purposeId: mockPurposeId } })
    );
  });

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
        body as bffApi.RiskAnalysisSignSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
