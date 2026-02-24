/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  RiskAnalysisId,
  generateId,
  operationForbidden,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidEServiceTemplateRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  AuthRole,
  RiskAnalysisValidationIssue,
  authRole,
} from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
  riskAnalysisValidationFailed,
  templateNotInReceiveMode,
  riskAnalysisNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/riskAnalysis/:riskAnalysisId", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const mockValidRiskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
    tenantKind.PA
  );
  const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
    buildRiskAnalysisSeed(mockValidRiskAnalysis);

  const makeRequest = async (
    token: string,
    body: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed = riskAnalysisSeed,
    templateId: EServiceTemplateId = eserviceTemplateId,
    riskAnalysisId: RiskAnalysisId = mockValidRiskAnalysis.id
  ) =>
    request(api)
      .post(`/templates/${templateId}/riskAnalysis/${riskAnalysisId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    eserviceTemplateService.updateRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      templateId: eserviceTemplateId,
      riskAnalysisId: mockValidRiskAnalysis.id,
      seed: {},
    },
    {
      templateId: eserviceTemplateId,
      riskAnalysisId: mockValidRiskAnalysis.id,
      seed: { invalid: 1 },
    },
    {
      templateId: eserviceTemplateId,
      riskAnalysisId: "invalid",
      seed: riskAnalysisSeed,
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, riskAnalysisId, seed }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        seed as eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed,
        templateId,
        riskAnalysisId as RiskAnalysisId
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    {
      error: eserviceTemplateNotFound(eserviceTemplateId),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateNotInDraftState(eserviceTemplateId),
      expectedStatus: 400,
    },
    {
      error: templateNotInReceiveMode(eserviceTemplateId),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisNotFound(eserviceTemplateId, mockValidRiskAnalysis.id),
      expectedStatus: 404,
    },
    {
      error: riskAnalysisValidationFailed([
        new RiskAnalysisValidationIssue({
          code: "rulesVersionNotFoundError",
          detail: "no rule",
        }),
      ]),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateRiskAnalysis = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
