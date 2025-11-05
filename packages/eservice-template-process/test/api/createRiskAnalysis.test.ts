/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplate,
  EServiceTemplateId,
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
  eserviceTemplateRiskAnalysisNameDuplicate,
  riskAnalysisValidationFailed,
  templateNotInReceiveMode,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API POST /templates/:templateId/riskAnalysis", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const mockValidRiskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
    tenantKind.PA
  );
  const riskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed =
    buildRiskAnalysisSeed(mockValidRiskAnalysis);

  const mockEServiceTemplate: EServiceTemplate = getMockEServiceTemplate();

  const serviceResponse = getMockWithMetadata({
    eserviceTemplate: mockEServiceTemplate,
    createdRiskAnalysisId: generateId(),
  });

  const apiResponse =
    eserviceTemplateApi.CreatedEServiceTemplateRiskAnalysis.parse({
      eserviceTemplate:
        eserviceTemplateToApiEServiceTemplate(mockEServiceTemplate),
      createdRiskAnalysisId: serviceResponse.data.createdRiskAnalysisId,
    });

  const makeRequest = async (
    token: string,
    body: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed = riskAnalysisSeed,
    templateId: EServiceTemplateId = eserviceTemplateId
  ) =>
    request(api)
      .post(`/templates/${templateId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    eserviceTemplateService.createRiskAnalysis = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
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
    {},
    { ...mockValidRiskAnalysis, name: 1 },
    { ...mockValidRiskAnalysis, notValid: "NOT_VALID" },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed
    );

    expect(res.status).toBe(400);
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
    {
      error: eserviceTemplateRiskAnalysisNameDuplicate("risk"),
      expectedStatus: 409,
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
