import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockValidRiskAnalysis,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceRiskAnalysisNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { buildRiskAnalysisSeed } from "../../mockUtils.js";
import { toM2MGatewayApiEServiceRiskAnalysis } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /eservice/:eserviceId/riskAnalyses router test", () => {
  const mockRiskAnalysisSeed: m2mGatewayApi.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA));

  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockRiskAnalysis: catalogApi.EServiceRiskAnalysis =
    mockEService.riskAnalysis[0]!;

  const mockM2MEserviceResponse: m2mGatewayApi.EServiceRiskAnalysis =
    toM2MGatewayApiEServiceRiskAnalysis(mockRiskAnalysis);

  const makeRequest = async (
    token: string,
    eserviceId: string,
    body: m2mGatewayApi.EServiceRiskAnalysisSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eserviceId}/riskAnalyses`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.createEServiceRiskAnalysis = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockRiskAnalysisSeed
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEserviceResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, mockRiskAnalysisSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockRiskAnalysisSeed, extraParam: 0 },
    { ...mockRiskAnalysisSeed, name: undefined },
  ])("Should return 400 if passed invalid risk analysis seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      body as unknown as m2mGatewayApi.EServiceRiskAnalysisSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
    eserviceRiskAnalysisNotFound(unsafeBrandId(mockEService.id), generateId()),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.createEServiceRiskAnalysis = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, mockRiskAnalysisSeed);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockRiskAnalysis, createdAt: "invalid-date" },
    { ...mockRiskAnalysis, name: undefined },
    { ...mockRiskAnalysis, extraParam: "extraValue" },
    { extraParam: true },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.createEServiceRiskAnalysis = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockRiskAnalysisSeed
      );

      expect(res.status).toBe(500);
    }
  );
});
