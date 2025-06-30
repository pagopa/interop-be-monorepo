/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId, RiskAnalysisId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /eservices/:eServiceId/riskAnalysis/:riskAnalysisId", () => {
  beforeEach(() => {
    clients.catalogProcessClient.deleteRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    riskAnalysisId: RiskAnalysisId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eServiceId}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, riskAnalysisId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, riskAnalysisId);
      expect(res.status).toBe(400);
    }
  );
});
