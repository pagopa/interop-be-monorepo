/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiEServiceTemplateRiskAnalysisSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/templates/:eServiceTemplateId/riskAnalysis", () => {
  const mockEServiceTemplateRiskAnalysisSeed =
    getMockBffApiEServiceTemplateRiskAnalysisSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.createEServiceTemplateRiskAnalysis =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    body: bffApi.EServiceTemplateRiskAnalysisSeed = mockEServiceTemplateRiskAnalysisSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/riskAnalysis`
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
    async ({ eServiceTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        body as bffApi.EServiceTemplateRiskAnalysisSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
