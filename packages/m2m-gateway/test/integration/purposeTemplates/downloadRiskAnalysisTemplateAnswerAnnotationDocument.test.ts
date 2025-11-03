import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  PurposeTemplateId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
} from "pagopa-interop-models";
import {
  getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("downloadRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockPurposeTemplateId = generateId<PurposeTemplateId>();
  const mockAnswerId = generateId<RiskAnalysisSingleAnswerId>();
  const mockDocumentId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();
  const mockDocumentName = "doc.pdf";
  const mockDocument = getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument(
    {
      id: mockDocumentId,
      path: `${config.purposeTemplateDocumentsPath}/${mockDocumentId}/${mockDocumentName}`,
      name: mockDocumentName,
    }
  );
  const mockPurposeTemplateProcessResponse = getMockWithMetadata(mockDocument);
  const mockGetRiskAnalysisTemplateAnswerAnnotationDocument = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getRiskAnalysisTemplateAnswerAnnotationDocument:
      mockGetRiskAnalysisTemplateAnswerAnnotationDocument,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetRiskAnalysisTemplateAnswerAnnotationDocument.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.purposeTemplateDocumentsContainer,
        path: config.purposeTemplateDocumentsPath,
        resourceId: mockDocument.id,
        name: mockDocument.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.purposeTemplateDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toEqual(mockDocument.path);

    const result =
      await purposeTemplateService.downloadRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: mockPurposeTemplateId,
          answerId: mockAnswerId,
          documentId: mockDocumentId,
          ctx: getMockM2MAdminAppContext(),
        }
      );

    const expectedServiceResponse = {
      id: mockDocument.id,
      file: new File([Buffer.from(testFileContent)], mockDocument.name, {
        type: mockDocument.contentType,
      }),
      prettyName: mockDocument.prettyName,
    };
    expect(result).toEqual(expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getRiskAnalysisTemplateAnswerAnnotationDocument,
      params: {
        purposeTemplateId: mockPurposeTemplateId,
        answerId: mockAnswerId,
        documentId: mockDocumentId,
      },
    });
  });
});
