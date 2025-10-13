/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplate,
  EServiceTemplateId,
  RiskAnalysisId,
  generateId,
  operationForbidden,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockValidEServiceTemplateRiskAnalysis,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
  templateNotInReceiveMode,
} from "../../src/model/domain/errors.js";

describe("API DELETE /templates/:templateId/riskAnalysis/:riskAnalysisId", () => {
  const riskAnalysis = getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
  const eserviceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    riskAnalysis: [riskAnalysis],
  };
  const serviceResponse = getMockWithMetadata(eserviceTemplate);

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = eserviceTemplate.id,
    riskAnalysisId: RiskAnalysisId = riskAnalysis.id
  ) =>
    request(api)
      .delete(`/templates/${templateId}/riskAnalysis/${riskAnalysisId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.deleteRiskAnalysis = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
      expect(res.headers["x-metadata-version"]).toEqual(
        serviceResponse.metadata.version.toString()
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

  it.each([
    {
      error: eserviceTemplateNotFound(eserviceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateNotInDraftState(eserviceTemplate.id),
      expectedStatus: 400,
    },
    {
      error: templateNotInReceiveMode(eserviceTemplate.id),
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
      riskAnalysisId: riskAnalysis.id,
    },
    {
      templateId: eserviceTemplate.id,
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
