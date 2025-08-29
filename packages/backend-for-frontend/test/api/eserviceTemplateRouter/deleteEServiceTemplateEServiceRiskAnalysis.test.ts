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
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId", () => {
  beforeEach(() => {
    clients.eserviceTemplateProcessClient.deleteEServiceTemplateRiskAnalysis =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    riskAnalysisId: RiskAnalysisId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, riskAnalysisId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceTemplateId, riskAnalysisId);
      expect(res.status).toBe(400);
    }
  );
});
