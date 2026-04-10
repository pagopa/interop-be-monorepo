/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EServiceTemplateId,
  RiskAnalysisId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateNotFound,
  riskAnalysisNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /maintenance/templates/{templateId}/riskAnalyses/{riskAnalysisId}/tenantKind/fix test", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockRiskAnalysisId = generateId<RiskAnalysisId>();

  eserviceTemplateService.fixEServiceTemplateRiskAnalysisTenantKind = vi
    .fn()
    .mockResolvedValue({
      data: mockEServiceTemplate,
      metadata: { version: 1 },
    });

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = mockEServiceTemplate.id,
    riskAnalysisId: RiskAnalysisId = mockRiskAnalysisId
  ) =>
    request(api)
      .post(
        `/maintenance/templates/${templateId}/riskAnalyses/${riskAnalysisId}/tenantKind/fix`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.fixEServiceTemplateRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(eserviceTemplateNotFound(mockEServiceTemplate.id));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for riskAnalysisNotFound", async () => {
    eserviceTemplateService.fixEServiceTemplateRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(
        riskAnalysisNotFound(mockEServiceTemplate.id, mockRiskAnalysisId)
      );

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { templateId: "invalid" as EServiceTemplateId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, riskAnalysisId }) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        templateId ?? mockEServiceTemplate.id,
        riskAnalysisId ?? mockRiskAnalysisId
      );
      expect(res.status).toBe(400);
    }
  );
});
