import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockValidEServiceTemplateRiskAnalysis,
  getMockedApiEServiceTemplate,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceRiskAnalysisNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayApiEServiceTemplateRiskAnalysis } from "../../../src/api/eserviceTemplateApiConverter.js";
import { buildEserviceTemplateRiskAnalysisSeed } from "../../mockUtils.js";

describe("POST /eserviceTemplates/:templateId/riskAnalyses router test", () => {
  const mockRiskAnalysisSeed: m2mGatewayApiV3.EServiceTemplateRiskAnalysisSeed =
    buildEserviceTemplateRiskAnalysisSeed(
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)
    );

  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    mockEServiceTemplate.riskAnalysis[0]!;

  const mockM2MEserviceResponse: m2mGatewayApiV3.EServiceTemplateRiskAnalysis =
    toM2MGatewayApiEServiceTemplateRiskAnalysis(mockRiskAnalysis);

  const makeRequest = async (
    token: string,
    templateId: string,
    body: m2mGatewayApiV3.EServiceTemplateRiskAnalysisSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eserviceTemplates/${templateId}/riskAnalyses`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.createEServiceTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        mockRiskAnalysisSeed
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEserviceResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      mockRiskAnalysisSeed
    );
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockRiskAnalysisSeed, extraParam: 0 },
    { ...mockRiskAnalysisSeed, name: undefined },
  ])("Should return 400 if passed invalid risk analysis seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      body as unknown as m2mGatewayApiV3.EServiceTemplateRiskAnalysisSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
    eserviceRiskAnalysisNotFound(
      unsafeBrandId(mockEServiceTemplate.id),
      generateId()
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEServiceTemplateService.createEServiceTemplateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      mockRiskAnalysisSeed
    );

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockRiskAnalysis, createdAt: "invalid-date" },
    { ...mockRiskAnalysis, name: undefined },
    { ...mockRiskAnalysis, extraParam: "extraValue" },
    { extraParam: true },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.createEServiceTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        mockRiskAnalysisSeed
      );

      expect(res.status).toBe(500);
    }
  );
});
