/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, tenantKind } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { riskAnalysisFormConfigToApiRiskAnalysisFormConfig } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposes/riskAnalysis/latest test", () => {
  const mockRiskAnalysisConfiguration = {
    version: "1",
    questions: [],
  };

  const apiResponse = purposeApi.RiskAnalysisFormConfigResponse.parse(
    riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
      mockRiskAnalysisConfiguration
    )
  );

  beforeEach(() => {
    purposeService.retrieveLatestRiskAnalysisConfiguration = vi
      .fn()
      .mockResolvedValue(mockRiskAnalysisConfiguration);
  });

  const makeRequest = async (
    token: string,
    query: object = { tenantKind: tenantKind.PA }
  ) =>
    request(api)
      .get("/purposes/riskAnalysis/latest")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([{ query: { tenantKind: "invalid" } }])(
    "Should return 400 if passed invalid data: %s",
    async ({ query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, query);
      expect(res.status).toBe(400);
    }
  );
});
