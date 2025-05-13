/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  TenantId,
  generateId,
  operationForbidden,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysis,
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
  eServiceTemplateNotFound,
  eserviceTemaplateRiskAnalysisNameDuplicate,
  eserviceTemplateNotInDraftState,
  riskAnalysisValidationFailed,
  templateNotInReceiveMode,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/riskAnalysis", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const mockValidRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
  const riskAnalysisSeed: eserviceTemplateApi.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(mockValidRiskAnalysis);
  const tenantId = generateId<TenantId>();

  const makeRequest = async (
    token: string,
    body: eserviceTemplateApi.EServiceRiskAnalysisSeed = riskAnalysisSeed,
    templateId: string = eserviceTemplateId
  ) =>
    request(api)
      .post(`/templates/${templateId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    eserviceTemplateService.createRiskAnalysis = vi
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
    {},
    { ...mockValidRiskAnalysis, name: 1 },
    { ...mockValidRiskAnalysis, notValid: "NOT_VALID" },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as eserviceTemplateApi.EServiceRiskAnalysisSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: eServiceTemplateNotFound(eserviceTemplateId),
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
      error: riskAnalysisValidationFailed([
        new RiskAnalysisValidationIssue({
          code: "noRulesVersionFoundError",
          detail: "no rule",
        }),
      ]),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eserviceTemaplateRiskAnalysisNameDuplicate("risk"),
      expectedStatus: 409,
    },
    {
      error: tenantNotFound(tenantId),
      expectedStatus: 500,
    },
    {
      error: tenantKindNotFound(tenantId),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.createRiskAnalysis = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
