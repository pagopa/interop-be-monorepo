/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateId,
  RiskAnalysisFormTemplate,
  generateId,
  purposeTemplateState,
  tenantKind,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { riskAnalysisFormTemplateToApiRiskAnalysisFormTemplate } from "../../src/model/domain/apiConverter.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
} from "../../src/model/domain/errors.js";
import { buildRiskAnalysisFormTemplateSeed } from "../mockUtils.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";

describe("API PUT /purposeTemplates/{purposeTemplateId}/riskAnalysis", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId = generateId<PurposeTemplateId>();

  const mockRiskAnalysisFormTemplate: RiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);

  const validRiskAnalysisFormTemplateSeed: purposeTemplateApi.RiskAnalysisFormTemplateSeed =
    buildRiskAnalysisFormTemplateSeed(mockRiskAnalysisFormTemplate);

  const purposeTemplateResponse = getMockWithMetadata(
    mockRiskAnalysisFormTemplate,
    2
  );

  beforeEach(() => {
    purposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
      .fn()
      .mockResolvedValue(purposeTemplateResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateSeed: purposeTemplateApi.RiskAnalysisFormTemplateSeed
  ) =>
    request(api)
      .put(`/purposeTemplates/${purposeTemplateId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(purposeTemplateSeed);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, validRiskAnalysisFormTemplateSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        riskAnalysisFormTemplateToApiRiskAnalysisFormTemplate(
          mockRiskAnalysisFormTemplate
        )
      );
      expect(res.headers["x-metadata-version"]).toBe(
        purposeTemplateResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, validRiskAnalysisFormTemplateSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    {
      ...validRiskAnalysisFormTemplateSeed,
      answers: {
        invalidAnswer: {},
      },
    },
    {
      ...validRiskAnalysisFormTemplateSeed,
      version: -1,
    },
  ])("Should return 400 if risk analysis template is invalid", async (body) => {
    purposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
      .fn()
      .mockRejectedValue({
        code: "riskAnalysisTemplateValidationFailed",
        detail: "detail",
      });
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as purposeTemplateApi.RiskAnalysisFormTemplateSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 409 if purpose template is not in draft state", async () => {
    const mockPurposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
    };

    purposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(
        purposeTemplateNotInExpectedStates(
          mockPurposeTemplate.id,
          mockPurposeTemplate.state,
          [purposeTemplateState.draft]
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validRiskAnalysisFormTemplateSeed);
    expect(res.status).toBe(409);
  });

  it("Should return 404 if purpose template not found", async () => {
    purposeTemplateService.updatePurposeTemplateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(purposeTemplateNotFound(purposeTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validRiskAnalysisFormTemplateSeed);
    expect(res.status).toBe(404);
  });
});
