import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEServiceTemplateRiskAnalysis } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("GET /eservices/:templateId/riskAnalyses router test", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockApiEserviceTemplateRiskAnalysis1 =
    mockEServiceTemplate.riskAnalysis[0]!;
  const mockApiEserviceTemplateRiskAnalysis2 =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;

  const mockM2MEserviceTemplateRiskAnalysesResponse: m2mGatewayApiV3.EServiceTemplateRiskAnalyses =
    {
      pagination: { offset: 0, limit: 10, totalCount: 2 },
      results: [
        toM2MGatewayApiEServiceTemplateRiskAnalysis(
          mockApiEserviceTemplateRiskAnalysis1
        ),
        toM2MGatewayApiEServiceTemplateRiskAnalysis(
          mockApiEserviceTemplateRiskAnalysis2
        ),
      ],
    };

  const mockQueryParams: m2mGatewayApiV3.GetEServiceTemplateRiskAnalysesQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const makeRequest = async (
    token: string,
    templateId: string,
    query: m2mGatewayApiV3.GetEServiceTemplateRiskAnalysesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/eserviceTemplates/${templateId}/riskAnalyses`)
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
      mockEServiceTemplateService.getEServiceTemplateRiskAnalyses = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceTemplateRiskAnalysesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceTemplateRiskAnalysesResponse);
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
      query as m2mGatewayApiV3.GetEServiceTemplateRiskAnalysesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEserviceTemplateRiskAnalysesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateRiskAnalysesResponse.results[0],
          invalid: "invalid",
        },
      ],
    },
    {
      ...mockM2MEserviceTemplateRiskAnalysesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateRiskAnalysesResponse.results[0],
          createdAt: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceTemplateRiskAnalysesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplateRiskAnalyses = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);
      expect(res.status).toBe(500);
    }
  );
});
