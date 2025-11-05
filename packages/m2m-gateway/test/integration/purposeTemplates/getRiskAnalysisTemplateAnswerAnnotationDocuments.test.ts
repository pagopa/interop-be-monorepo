import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisSingleAnswerId,
} from "pagopa-interop-models";
import { getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument } from "pagopa-interop-commons-test/index.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getRiskAnalysisTemplateAnswerAnnotationDocuments", () => {
  const mockQueryParams: m2mGatewayApi.GetRiskAnalysisTemplateAnswerAnnotationDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockApiRiskAnalysisTemplateAnswerAnnotationDoc1 =
    getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument();
  const mockApiRiskAnalysisTemplateAnswerAnnotationDoc2 =
    getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument();

  const mockApiRiskAnalysisTemplateAnswerAnnotationDocs = [
    mockApiRiskAnalysisTemplateAnswerAnnotationDoc1,
    mockApiRiskAnalysisTemplateAnswerAnnotationDoc2,
  ];

  const mockPurposeTemplateProcessResponse: WithMaybeMetadata<purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocuments> =
    {
      data: {
        results: mockApiRiskAnalysisTemplateAnswerAnnotationDocs,
        totalCount: mockApiRiskAnalysisTemplateAnswerAnnotationDocs.length,
      },
      metadata: undefined,
    };

  const mockGetRiskAnalysisTemplateAnswerAnnotationDocuments = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getRiskAnalysisTemplateAnswerAnnotationDocuments:
      mockGetRiskAnalysisTemplateAnswerAnnotationDocuments,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetRiskAnalysisTemplateAnswerAnnotationDocuments.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDocument1: m2mGatewayApi.Document = {
      id: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.id,
      name: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.name,
      contentType: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.contentType,
      createdAt: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.createdAt,
      prettyName: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.prettyName,
    };

    const m2mDocument2: m2mGatewayApi.Document = {
      id: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.id,
      name: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.name,
      contentType: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.contentType,
      createdAt: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.createdAt,
      prettyName: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.prettyName,
    };

    const m2mDocumentsResponse: m2mGatewayApi.Documents = {
      pagination: {
        limit: mockQueryParams.limit,
        offset: mockQueryParams.offset,
        totalCount: mockPurposeTemplateProcessResponse.data.totalCount,
      },
      results: [m2mDocument1, m2mDocument2],
    };

    const purposeTemplateId = generateId<PurposeTemplateId>();
    const answerId = generateId<RiskAnalysisSingleAnswerId>();
    const result =
      await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocuments(
        purposeTemplateId,
        answerId,
        mockQueryParams,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(m2mDocumentsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getRiskAnalysisTemplateAnswerAnnotationDocuments,
      params: {
        id: purposeTemplateId,
        answerId,
      },
      queries: {
        offset: mockQueryParams.offset,
        limit: mockQueryParams.limit,
      },
    });
  });
});
