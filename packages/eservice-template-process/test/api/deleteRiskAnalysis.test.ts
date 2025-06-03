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
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
  templateNotInReceiveMode,
} from "../../src/model/domain/errors.js";

describe("API DELETE /templates/:templateId/riskAnalysis/:riskAnalysisId", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const mockValidRiskAnalysisId = generateId<RiskAnalysisId>();

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = eserviceTemplateId,
    riskAnalysisId: RiskAnalysisId = mockValidRiskAnalysisId
  ) =>
    request(api)
      .delete(`/templates/${templateId}/riskAnalysis/${riskAnalysisId}`)
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
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.deleteRiskAnalysis = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      templateId: "invalidId",
      riskAnalysisId: mockValidRiskAnalysisId,
    },
    {
      templateId: eserviceTemplateId,
      riskAnalysisId: "invalidId",
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, riskAnalysisId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        riskAnalysisId as RiskAnalysisId
      );

      expect(res.status).toBe(400);
    }
  );
});
