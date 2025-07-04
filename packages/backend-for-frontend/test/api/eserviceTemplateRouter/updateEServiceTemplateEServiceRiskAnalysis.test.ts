/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  generateId,
  RiskAnalysisId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiEServiceTemplateRiskAnalysisSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId", () => {
  const mockEServiceTemplateRiskAnalysisSeed =
    getMockBffApiEServiceTemplateRiskAnalysisSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateEServiceTemplateRiskAnalysis =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    riskAnalysisId: string = generateId(),
    body: bffApi.EServiceTemplateRiskAnalysisSeed = mockEServiceTemplateRiskAnalysisSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
    { body: {} },
    {
      body: {
        ...mockEServiceTemplateRiskAnalysisSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockEServiceTemplateRiskAnalysisSeed,
        riskAnalysisForm: {},
      },
    },
    {
      body: {
        ...mockEServiceTemplateRiskAnalysisSeed,
        tenantKind: "invalid",
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, riskAnalysisId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        riskAnalysisId,
        body as bffApi.EServiceTemplateRiskAnalysisSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
