/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  RiskAnalysisId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eServiceTemplateNotFound,
  eserviceTemplateNotInDraftState,
  templateNotInReceiveMode,
} from "../../src/model/domain/errors.js";

describe("API DELETE /templates/:templateId/riskAnalysis/:riskAnalysisId", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const mockValidRiskAnalysisId = generateId<RiskAnalysisId>();

  const makeRequest = async (
    token: string,
    templateId: string = eserviceTemplateId,
    riskAnlysisId: string = mockValidRiskAnalysisId
  ) =>
    request(api)
      .delete(`/templates/${templateId}/riskAnalysis/${riskAnlysisId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.deleteRiskAnalysis = vi
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

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.deleteRiskAnalysis = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(eserviceTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${eserviceTemplateId} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.deleteRiskAnalysis = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 400 for eserviceTemplateNotInDraftState", async () => {
    eserviceTemplateService.deleteRiskAnalysis = vi
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
    eserviceTemplateService.deleteRiskAnalysis = vi
      .fn()
      .mockRejectedValue(templateNotInReceiveMode(eserviceTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${eserviceTemplateId} is not in receive mode`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed a not compliat query param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "111");
    expect(res.status).toBe(400);
  });
});
