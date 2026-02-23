import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEServiceRiskAnalysis } from "../../../src/api/eserviceApiConverter.js";
import { eserviceRiskAnalysisNotFound } from "../../../src/model/errors.js";

describe("GET /eservices/:eserviceId/riskAnalyses/:riskAnalysisId router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockRiskAnalysis: catalogApi.EServiceRiskAnalysis =
    mockEService.riskAnalysis[0]!;

  const mockM2MRiskAnalysisResponse: m2mGatewayApiV3.EServiceRiskAnalysis =
    toM2MGatewayApiEServiceRiskAnalysis(mockRiskAnalysis);

  const makeRequest = async (
    token: string,
    eserviceId: string,
    riskAnalysisId: string
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eserviceId}/riskAnalyses/${riskAnalysisId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEServiceRiskAnalysis = vi
        .fn()
        .mockResolvedValue(mockM2MRiskAnalysisResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockRiskAnalysis.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MRiskAnalysisResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, mockRiskAnalysis.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId", mockRiskAnalysis.id);

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid risk analysis id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, "invalidId");

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MRiskAnalysisResponse, id: undefined },
    { ...mockM2MRiskAnalysisResponse, invalidParam: "invalidValue" },
    { ...mockM2MRiskAnalysisResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEServiceRiskAnalysis = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockRiskAnalysis.id
      );

      expect(res.status).toBe(500);
    }
  );

  it("Should return 404 in case of eserviceRiskAnalysisNotFound error", async () => {
    mockEserviceService.getEServiceRiskAnalysis = vi
      .fn()
      .mockRejectedValue(
        eserviceRiskAnalysisNotFound(mockEService.id, mockRiskAnalysis.id)
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, mockRiskAnalysis.id);

    expect(res.status).toBe(404);
  });
});
