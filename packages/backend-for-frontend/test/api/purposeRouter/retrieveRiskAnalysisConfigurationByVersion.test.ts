/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiRiskAnalysisFormConfig } from "../../mockUtils.js";

describe("API GET /purposes/riskAnalysis/version/{riskAnalysisVersion} test", () => {
  const mockRiskAnalysisFormConfig = getMockBffApiRiskAnalysisFormConfig();
  const defaultQuery: { eserviceId: EServiceId } = { eserviceId: generateId() };

  beforeEach(() => {
    services.purposeService.retrieveRiskAnalysisConfigurationByVersion = vi
      .fn()
      .mockResolvedValue(mockRiskAnalysisFormConfig);
  });

  const makeRequest = async (
    token: string,
    riskAnalysisVersion: string = "1",
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposes/riskAnalysis/version/${riskAnalysisVersion}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockRiskAnalysisFormConfig);
  });

  it.each([{ query: {} }, { query: { eserviceId: "invalid" } }])(
    "Should return 400 if passed invalid data: %s",
    async ({ query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, "1", query as typeof defaultQuery);
      expect(res.status).toBe(400);
    }
  );
});
