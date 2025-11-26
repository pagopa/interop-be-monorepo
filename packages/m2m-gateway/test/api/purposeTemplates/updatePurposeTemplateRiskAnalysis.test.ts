import { generateMock } from "@anatine/zod-mock";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  AuthRole,
  authRole,
  getLatestVersionFormRules,
} from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  generateId,
  pollingMaxRetriesExceeded,
  PurposeTemplateId,
  tenantKind,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";

describe("PUT /purposeTemplates/:purposeTemplateId/riskAnalysis router test", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();

  const mockRiskAnalysisFormTemplate = generateMock(
    m2mGatewayApi.RiskAnalysisFormTemplate
  );

  const mockUpdateSeed: m2mGatewayApi.RiskAnalysisFormTemplateSeed = {
    version: getLatestVersionFormRules(tenantKind.PA)!.version,
    answers: {
      purpose: {
        editable: false,
        values: ["New value"],
        suggestedValues: [],
      },
    },
  };

  const makeRequest = async (
    token: string,
    templateId: string = purposeTemplateId,
    body: m2mGatewayApi.RiskAnalysisFormTemplateSeed = mockUpdateSeed
  ) =>
    request(api)
      .put(`${appBasePath}/purposeTemplates/${templateId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValue(mockRiskAnalysisFormTemplate);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRiskAnalysisFormTemplate);
      expect(
        mockPurposeTemplateService.updatePurposeTemplateRiskAnalysis
      ).toHaveBeenCalledWith(
        purposeTemplateId,
        mockUpdateSeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidPurposeId");
    expect(res.status).toBe(400);
  });

  it.each([
    {},
    {
      ...mockUpdateSeed,
      answers: {
        invalidAnswer: {},
      },
    },
    { ...mockUpdateSeed, version: -1 },
  ])("Should return 400 if passed invalid seed %s", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      purposeTemplateId,
      seed as m2mGatewayApi.RiskAnalysisFormTemplateSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    {},
    { ...mockRiskAnalysisFormTemplate, version: -1 },
    {
      ...mockRiskAnalysisFormTemplate,
      answers: {
        answers: {
          invalidAnswer: {},
        },
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
