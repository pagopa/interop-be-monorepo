import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { eserviceTemplateRiskAnalysisNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayApiEServiceTemplateRiskAnalysis } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("GET /eserviceTemplates/:templateId/riskAnalyses/:riskAnalysisId router test", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    mockEServiceTemplate.riskAnalysis[0]!;

  const mockM2MRiskAnalysisResponse: m2mGatewayApiV3.EServiceTemplateRiskAnalysis =
    toM2MGatewayApiEServiceTemplateRiskAnalysis(mockRiskAnalysis);

  const makeRequest = async (
    token: string,
    templateId: string,
    riskAnalysisId: string
  ) =>
    request(api)
      .get(
        `${appBasePath}/eserviceTemplates/${templateId}/riskAnalyses/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.getEServiceTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValue(mockM2MRiskAnalysisResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        mockRiskAnalysis.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MRiskAnalysisResponse);
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

  it.each([
    { ...mockM2MRiskAnalysisResponse, id: undefined },
    { ...mockM2MRiskAnalysisResponse, invalidParam: "invalidValue" },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        mockRiskAnalysis.id
      );

      expect(res.status).toBe(500);
    }
  );

  it("Should return 404 in case of eserviceTemplateRiskAnalysisNotFound error", async () => {
    mockEServiceTemplateService.getEServiceTemplateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateRiskAnalysisNotFound(
          mockEServiceTemplate.id,
          mockRiskAnalysis.id
        )
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      mockRiskAnalysis.id
    );

    expect(res.status).toBe(404);
  });
});
