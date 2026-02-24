import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisSingleAnswerId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { annotationDocumentToApiAnnotationDocumentWithAnswerId } from "../../src/model/domain/apiConverter.js";
import { purposeTemplateNotFound } from "../../src/model/domain/errors.js";

describe("API GET /purposeTemplates/:id/riskAnalysis/annotationDocuments test", () => {
  const mockAnswerId = generateId<RiskAnalysisSingleAnswerId>();
  const mockDocument1 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockDocument2 = getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockDocumentWithAnswerId1 = {
    answerId: mockAnswerId,
    document: mockDocument1,
  };
  const mockDocumentWithAnswerId2 = {
    answerId: mockAnswerId,
    document: mockDocument2,
  };
  const mockPurposeTemplateId = generateId<PurposeTemplateId>();

  const mockProcessResponse = {
    results: [mockDocumentWithAnswerId1, mockDocumentWithAnswerId2],
    totalCount: 2,
  };

  const apiResponse =
    purposeTemplateApi.RiskAnalysisTemplateAnnotationDocumentsWithAnswerId.parse(
      {
        results: [
          annotationDocumentToApiAnnotationDocumentWithAnswerId(
            mockDocumentWithAnswerId1
          ),
          annotationDocumentToApiAnnotationDocumentWithAnswerId(
            mockDocumentWithAnswerId2
          ),
        ],
        totalCount: mockProcessResponse.totalCount,
      }
    );

  const mockQueryParams: purposeTemplateApi.GetRiskAnalysisTemplateAnnotationDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  beforeEach(() => {
    purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments = vi
      .fn()
      .mockResolvedValue(mockProcessResponse);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = mockPurposeTemplateId,
    query: purposeTemplateApi.GetRiskAnalysisTemplateAnnotationDocumentsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(
        `/purposeTemplates/${purposeTemplateId}/riskAnalysis/annotationDocuments`
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
        purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments
      ).toHaveBeenCalledWith(
        mockPurposeTemplateId,
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

  it("Should return 404 when purpose template is not found", async () => {
    const error = purposeTemplateNotFound(generateId());
    purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    {
      purposeTemplateId: "invalid" as PurposeTemplateId,
      answerId: mockAnswerId,
    },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ purposeTemplateId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId);
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
      query as unknown as purposeTemplateApi.GetRiskAnalysisTemplateAnnotationDocumentsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
