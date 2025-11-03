import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiRiskAnalysisFormTemplate } from "../../../src/api/riskAnalysisFormTemplateApiConverter.js";

describe("GET /purposeTemplates/:purposeTemplateId/risAnalysis router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockApiPurposeTemplate.id
  ) =>
    request(api)
      .get(`${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiPurposeTemplate = getMockedApiPurposeTemplate();
  const mockM2MPurposeTemplateRiskAnalysisResponse =
    toM2MGatewayApiRiskAnalysisFormTemplate(
      mockApiPurposeTemplate.purposeRiskAnalysisForm!
    );

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getPurposeTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplateRiskAnalysisResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplateRiskAnalysisResponse);
    }
  );

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockM2MPurposeTemplateRiskAnalysisResponse, version: undefined },
    { ...mockM2MPurposeTemplateRiskAnalysisResponse, answers: "invalidId" },
    { ...mockM2MPurposeTemplateRiskAnalysisResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.getPurposeTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiPurposeTemplate.id);

      expect(res.status).toBe(500);
    }
  );
});
