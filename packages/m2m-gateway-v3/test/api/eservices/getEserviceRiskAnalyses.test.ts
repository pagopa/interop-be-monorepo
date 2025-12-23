import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEServiceRiskAnalysis } from "../../../src/api/eserviceApiConverter.js";

describe("GET /eservices/:eserviceId/riskAnalyses router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockApiEserviceRiskAnalysis1 = mockEService.riskAnalysis[0]!;
  const mockApiEserviceRiskAnalysis2 = getMockedApiEservice().riskAnalysis[0]!;

  const mockM2MEserviceRiskAnalysesResponse: m2mGatewayApiV3.EServiceRiskAnalyses =
    {
      pagination: { offset: 0, limit: 10, totalCount: 2 },
      results: [
        toM2MGatewayApiEServiceRiskAnalysis(mockApiEserviceRiskAnalysis1),
        toM2MGatewayApiEServiceRiskAnalysis(mockApiEserviceRiskAnalysis2),
      ],
    };

  const mockQueryParams: m2mGatewayApiV3.GetEServiceRiskAnalysesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    eserviceId: string,
    query: m2mGatewayApiV3.GetEServiceRiskAnalysesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/${eserviceId}/riskAnalyses`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEServiceRiskAnalyses = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceRiskAnalysesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceRiskAnalysesResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockQueryParams);
    expect(res.status).toBe(403);
  });
  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: undefined },
    { ...mockQueryParams, limit: undefined },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      query as m2mGatewayApiV3.GetEServiceRiskAnalysesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEserviceRiskAnalysesResponse,
      results: [
        {
          ...mockM2MEserviceRiskAnalysesResponse.results[0],
          invalid: "invalid",
        },
      ],
    },
    {
      ...mockM2MEserviceRiskAnalysesResponse,
      results: [
        {
          ...mockM2MEserviceRiskAnalysesResponse.results[0],
          createdAt: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceRiskAnalysesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEServiceRiskAnalyses = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);
      expect(res.status).toBe(500);
    }
  );
});
