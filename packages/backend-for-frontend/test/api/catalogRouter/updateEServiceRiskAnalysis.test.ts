/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  generateId,
  RiskAnalysisId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients, services } from "../../vitest.api.setup.js";
import { getMockCatalogApiEService } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";

describe("API POST /eservices/:eServiceId/riskAnalysis/:riskAnalysisId", () => {
  const mockEService = getMockCatalogApiEService();
  const mockRiskAnalysis = mockEService.riskAnalysis[0];
  const mockEServiceRiskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed = {
    name: "name",
    riskAnalysisForm: {
      version: "1.0",
      answers: {},
    },
  };

  const makeRequest = async (
    token: string,
    riskAnalysisId: unknown = mockRiskAnalysis.id
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${mockEService.id}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEServiceRiskAnalysisSeed);

  beforeEach(() => {
    clients.catalogProcessClient.updateRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    {
      error: eserviceRiskNotFound(
        mockEService.id,
        generateId<RiskAnalysisId>()
      ),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(
        mockEService.id,
        generateId<DescriptorId>()
      ),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(mockEService.id, generateId<TenantId>()),
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

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
