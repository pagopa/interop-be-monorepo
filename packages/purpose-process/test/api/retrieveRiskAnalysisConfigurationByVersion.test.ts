/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceId, generateId, tenantKind } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { riskAnalysisFormConfigToApiRiskAnalysisFormConfig } from "../../src/model/domain/apiConverter.js";
import {
  eserviceNotFound,
  riskAnalysisConfigVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /purposes/riskAnalysis/version/{riskAnalysisVersion} test", () => {
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
    purposeService.retrieveRiskAnalysisConfigurationByVersion = vi
      .fn()
      .mockResolvedValue(mockRiskAnalysisConfiguration);
  });

  const makeRequest = async (
    token: string,
    riskAnalysisVersion: string = "1",
    query: { eserviceId: EServiceId } = { eserviceId: generateId() }
  ) =>
    request(api)
      .get(`/purposes/riskAnalysis/version/${riskAnalysisVersion}`)
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

  it.each([
    { error: eserviceNotFound(generateId()), expectedStatus: 404 },
    {
      error: riskAnalysisConfigVersionNotFound(
        mockRiskAnalysisConfiguration.version,
        tenantKind.PA
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.retrieveRiskAnalysisConfigurationByVersion = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed invalid data: %s", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, undefined, {
      eserviceId: "invalid" as EServiceId,
    });
    expect(res.status).toBe(400);
  });
});
