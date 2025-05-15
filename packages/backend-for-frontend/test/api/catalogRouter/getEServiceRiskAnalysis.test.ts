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
  const mockApiRiskAnalysis =
    toBffCatalogApiEserviceRiskAnalysis(mockRiskAnalysis);

  const makeRequest = async (
    token: string,
    riskAnalysisId: unknown = mockRiskAnalysis.id
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${mockEService.id}/riskAnalysis/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    clients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiRiskAnalysis);
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
      services.catalogService.getEServiceRiskAnalysis = vi
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
