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
  eserviceTemplateNotInDraftState,
  riskAnalysisValidationFailed,
  templateNotInReceiveMode,
  tenantKindNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/riskAnalysis/:riskAnalysisId", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const mockValidRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
  const riskAnalysisSeed: eserviceTemplateApi.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(mockValidRiskAnalysis);

  const makeRequest = async (
    token: string,
    body: eserviceTemplateApi.EServiceRiskAnalysisSeed = riskAnalysisSeed,
    templateId: string = eserviceTemplateId,
    riskAnlysisId: string = mockValidRiskAnalysis.id
  ) =>
    request(api)
      .post(`/templates/${templateId}/riskAnalysis/${riskAnlysisId}`)
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

  it("Should return 400 if passed a not compliant body", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      {} as eserviceTemplateApi.EServiceRiskAnalysisSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.updateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 400 for eserviceTemplateNotInDraftState", async () => {
    eserviceTemplateService.updateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(eserviceTemplateNotInDraftState(eserviceTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${eserviceTemplateId} is not in draft state`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for eserviceTemplateNotInReceiveMode", async () => {
    eserviceTemplateService.updateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(templateNotInReceiveMode(eserviceTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${eserviceTemplateId} is not in receive mode`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for riskAnalysisValidationFailed", async () => {
    eserviceTemplateService.updateRiskAnalysis = vi.fn().mockRejectedValue(
      riskAnalysisValidationFailed([
        new RiskAnalysisValidationIssue({
          code: "noRulesVersionFoundError",
          detail: "no rule",
        }),
      ])
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Risk analysis validation failed. Reasons: [no rule]`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 404 for tenantNotFound", async () => {
    const tenantId = generateId<TenantId>();
    eserviceTemplateService.updateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenantId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(`Tenant ${tenantId} not found`);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantKindNotFound", async () => {
    const tenantId = generateId<TenantId>();
    eserviceTemplateService.updateRiskAnalysis = vi
      .fn()
      .mockRejectedValue(tenantKindNotFound(tenantId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Tenant kind for tenant ${tenantId} not found`
    );
    expect(res.status).toBe(404);
  });
});
