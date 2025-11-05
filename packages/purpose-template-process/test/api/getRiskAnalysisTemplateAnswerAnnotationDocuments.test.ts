import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { annotationDocumentToApiAnnotationDocument } from "../../src/model/domain/apiConverter.js";
import {
  purposeTemplateNotFound,
  riskAnalysisTemplateAnswerNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API GET /purposeTemplates/:id/riskAnalysis/answers/:answerId/annotation/documents test", () => {
  const mockDocument1 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockDocument2 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockPurposeTemplateId = generateId<PurposeTemplateId>();
  const mockAnswerId = generateId<RiskAnalysisSingleAnswerId>();

  const mockProcessResponse = {
    results: [mockDocument1, mockDocument2],
    totalCount: 2,
  };

  const apiResponse =
    purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocuments.parse({
      results: mockProcessResponse.results.map(
        annotationDocumentToApiAnnotationDocument
      ),
      totalCount: mockProcessResponse.totalCount,
    });

  const mockQueryParams: purposeTemplateApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  beforeEach(() => {
    purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments = vi
      .fn()
      .mockResolvedValue(mockProcessResponse);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = mockPurposeTemplateId,
    answerId:
      | RiskAnalysisSingleAnswerId
      | RiskAnalysisMultiAnswerId = mockAnswerId,
    query: purposeTemplateApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(
        `/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents`
      )
      .query(query)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments
      ).toHaveBeenCalledWith(
        mockPurposeTemplateId,
        mockAnswerId,
        mockQueryParams,
        expect.any(Object) // context
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
    { error: purposeTemplateNotFound(generateId()), expectedStatus: 404 },
    {
      error: riskAnalysisTemplateAnswerNotFound({ answerId: generateId() }),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments =
        vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid" as PurposeTemplateId,
      answerId: mockAnswerId,
    },
    {
      purposeTemplateId: mockPurposeTemplateId,
      answerId: "invalid" as RiskAnalysisMultiAnswerId,
    },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ purposeTemplateId, answerId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId, answerId);
      expect(res.status).toBe(400);
    }
  );

  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      mockPurposeTemplateId,
      mockAnswerId,
      query as unknown as purposeTemplateApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
