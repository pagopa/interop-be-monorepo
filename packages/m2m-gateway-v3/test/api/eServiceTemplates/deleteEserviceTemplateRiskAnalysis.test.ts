import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /eserviceTemplates/:templateId/riskAnalyses/:riskAnalysisId router test", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    mockEServiceTemplate.riskAnalysis[0]!;

  const makeRequest = async (
    token: string,
    templateId: string,
    riskAnalysisId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eserviceTemplates/${templateId}/riskAnalyses/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.deleteEServiceTemplateRiskAnalysis = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        mockRiskAnalysis.id
      );

      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      mockRiskAnalysis.id
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid eservice template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId", mockRiskAnalysis.id);

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid risk analysis id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEServiceTemplate.id, "invalidId");

    expect(res.status).toBe(400);
  });
});
