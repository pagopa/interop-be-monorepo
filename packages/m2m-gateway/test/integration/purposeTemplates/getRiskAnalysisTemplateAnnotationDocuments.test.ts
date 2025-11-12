import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeTemplateApi } from "pagopa-interop-api-clients";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import { getMockedApiRiskAnalysisTemplateAnnotationDocumentWithAnswerId } from "pagopa-interop-commons-test/index.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getRiskAnalysisTemplateAnnotationDocuments", () => {
  const mockQueryParams: m2mGatewayApi.GetRiskAnalysisTemplateAnnotationDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockApiRiskAnalysisTemplateAnswerAnnotationDoc1 =
    getMockedApiRiskAnalysisTemplateAnnotationDocumentWithAnswerId();
  const mockApiRiskAnalysisTemplateAnswerAnnotationDoc2 =
    getMockedApiRiskAnalysisTemplateAnnotationDocumentWithAnswerId();

  const mockApiRiskAnalysisTemplateAnswerAnnotationDocs = [
    mockApiRiskAnalysisTemplateAnswerAnnotationDoc1,
    mockApiRiskAnalysisTemplateAnswerAnnotationDoc2,
  ];

  const mockPurposeTemplateProcessResponse: WithMaybeMetadata<purposeTemplateApi.RiskAnalysisTemplateAnnotationDocumentsWithAnswerId> =
    {
      data: {
        results: mockApiRiskAnalysisTemplateAnswerAnnotationDocs,
        totalCount: mockApiRiskAnalysisTemplateAnswerAnnotationDocs.length,
      },
      metadata: undefined,
    };

  const mockGetRiskAnalysisTemplateAnnotationDocuments = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getRiskAnalysisTemplateAnnotationDocuments:
      mockGetRiskAnalysisTemplateAnnotationDocuments,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetRiskAnalysisTemplateAnnotationDocuments.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDocument1: m2mGatewayApi.RiskAnalysisTemplateAnnotationDocument = {
      answerId: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.answerId,
      document: {
        id: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.document.id,
        name: mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.document.name,
        contentType:
          mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.document.contentType,
        createdAt:
          mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.document.createdAt,
        prettyName:
          mockApiRiskAnalysisTemplateAnswerAnnotationDoc1.document.prettyName,
      },
    };

    const m2mDocument2: m2mGatewayApi.RiskAnalysisTemplateAnnotationDocument = {
      answerId: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.answerId,
      document: {
        id: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.document.id,
        name: mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.document.name,
        contentType:
          mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.document.contentType,
        createdAt:
          mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.document.createdAt,
        prettyName:
          mockApiRiskAnalysisTemplateAnswerAnnotationDoc2.document.prettyName,
      },
    };

    const m2mDocumentsResponse: m2mGatewayApi.RiskAnalysisTemplateAnnotationDocuments =
      {
        pagination: {
          limit: mockQueryParams.limit,
          offset: mockQueryParams.offset,
          totalCount: mockPurposeTemplateProcessResponse.data.totalCount,
        },
        results: [m2mDocument1, m2mDocument2],
      };

    const purposeTemplateId = generateId<PurposeTemplateId>();
    const result =
      await purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments(
        purposeTemplateId,
        mockQueryParams,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(m2mDocumentsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getRiskAnalysisTemplateAnnotationDocuments,
      params: {
        purposeTemplateId,
      },
      queries: {
        offset: mockQueryParams.offset,
        limit: mockQueryParams.limit,
      },
    });
  });
});
