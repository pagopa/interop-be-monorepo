/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId, RiskAnalysisId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients, services } from "../../vitest.api.setup.js";
import {
  getMockBffApiEServiceRiskAnalysisSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";

describe("API POST /eservices/:eServiceId/riskAnalysis/:riskAnalysisId", () => {
  const mockEService = getMockCatalogApiEService();
  const mockRiskAnalysis = mockEService.riskAnalysis[0];
  const mockEServiceRiskAnalysisSeed = getMockBffApiEServiceRiskAnalysisSeed();

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    riskAnalysisId: unknown = mockRiskAnalysis.id,
    body: bffApi.EServiceRiskAnalysisSeed = mockEServiceRiskAnalysisSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.catalogProcessClient.updateRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
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
      services.catalogService.updateEServiceRiskAnalysis = vi
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
    { body: {} },
    { body: { ...mockEServiceRiskAnalysisSeed, extraField: 1 } },
    { body: { ...mockEServiceRiskAnalysisSeed, riskAnalysisForm: "invalid" } },
    {
      body: {
        ...mockEServiceRiskAnalysisSeed,
        riskAnalysisForm: { answers: "invalid" },
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, riskAnalysisId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        riskAnalysisId,
        body as bffApi.EServiceRiskAnalysisSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
