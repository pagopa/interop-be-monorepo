/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
} from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiDocument } from "../../../src/api/purposeTemplateApiConverter.js";

describe("GET /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents route test", () => {
  const mockResponse: m2mGatewayApi.Documents = {
    results: [
      getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument(),
      getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument(),
    ].map(toM2MGatewayApiDocument),
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId,
    answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
    query: m2mGatewayApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents`
      )
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockQueryParams: m2mGatewayApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments =
        vi.fn().mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        mockQueryParams
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      mockQueryParams
    );
    expect(res.status).toBe(403);
  });

  it.each([
    {
      purposeTemplateId: "invalid" as PurposeTemplateId,
      answerId: generateId<RiskAnalysisSingleAnswerId>(),
    },
    {
      purposeTemplateId: generateId<PurposeTemplateId>(),
      answerId: "invalid" as RiskAnalysisMultiAnswerId,
    },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ purposeTemplateId, answerId }) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        mockQueryParams
      );
      expect(res.status).toBe(400);
    }
  );

  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params: %s", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      query as unknown as m2mGatewayApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], createdAt: "invalidDate" }],
    },
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], createdAt: undefined }],
    },
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], invalidField: "invalidValue" }],
    },
    {
      ...mockResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response: %s",
    async (resp) => {
      mockPurposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments =
        vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        mockQueryParams
      );

      expect(res.status).toBe(500);
    }
  );
});
