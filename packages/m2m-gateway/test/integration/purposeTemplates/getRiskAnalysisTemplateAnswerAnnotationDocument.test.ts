import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const mockApiRiskAnalysisTemplateAnswerAnnotationDocumentResponse =
    getMockWithMetadata(
      getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument()
    );

  const mockGetRiskAnalysisTemplateAnswerAnnotationDocument = vi
    .fn()
    .mockResolvedValue(
      mockApiRiskAnalysisTemplateAnswerAnnotationDocumentResponse
    );

  mockInteropBeClients.purposeTemplateProcessClient = {
    getRiskAnalysisTemplateAnswerAnnotationDocument:
      mockGetRiskAnalysisTemplateAnswerAnnotationDocument,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetRiskAnalysisTemplateAnswerAnnotationDocument.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const answerId = generateId<RiskAnalysisSingleAnswerId>();
    const documentId =
      unsafeBrandId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(
        mockApiRiskAnalysisTemplateAnswerAnnotationDocumentResponse.data.id
      );
    const result =
      await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId,
          answerId,
          documentId,
          ctx: getMockM2MAdminAppContext(),
        }
      );

    expect(result).toEqual(
      mockApiRiskAnalysisTemplateAnswerAnnotationDocumentResponse.data
    );
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getRiskAnalysisTemplateAnswerAnnotationDocument,
      params: {
        purposeTemplateId,
        answerId,
        documentId,
      },
    });
  });
});
