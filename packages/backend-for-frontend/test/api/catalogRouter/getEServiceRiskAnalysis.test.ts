/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId, RiskAnalysisId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockCatalogApiEService } from "../../mockUtils.js";
import { toBffCatalogApiEserviceRiskAnalysis } from "../../../src/api/catalogApiConverter.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";

describe("API GET /eservices/:eServiceId/riskAnalysis/:riskAnalysisId", () => {
  const mockEService = getMockCatalogApiEService();
  const mockRiskAnalysis = mockEService.riskAnalysis[0];
  const mockApiRiskAnalysis = toBffCatalogApiEserviceRiskAnalysis(
    mockRiskAnalysis,
    undefined
  );

  beforeEach(() => {
    clients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    riskAnalysisId: RiskAnalysisId = mockRiskAnalysis.id as RiskAnalysisId
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eServiceId}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiRiskAnalysis);
  });

  it.each([
    {
      error: eserviceRiskNotFound(mockEService.id, generateId()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(mockEService.id, generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(mockEService.id, generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.getEServiceRiskAnalysis = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { riskAnalysisId: "invalid" as RiskAnalysisId },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, riskAnalysisId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, riskAnalysisId);
      expect(res.status).toBe(400);
    }
  );
});
