import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  PurposeTemplateId,
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
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockPurposeTemplateId = generateId<PurposeTemplateId>();
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
  const mockGetRiskAnalysisTemplateAnnotationDocument = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getRiskAnalysisTemplateAnnotationDocument:
      mockGetRiskAnalysisTemplateAnnotationDocument,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetRiskAnalysisTemplateAnnotationDocument.mockClear();
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
        mockPurposeTemplateId,
        mockDocumentId,
        getMockM2MAdminAppContext()
      );

    const expectedServiceResponse = {
      id: mockDocument.id,
      file: new File([Buffer.from(testFileContent)], mockDocument.name, {
        type: mockDocument.contentType,
      }),
      prettyName: mockDocument.prettyName,
    };

    await expectDownloadedDocumentToBeEqual(result, expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getRiskAnalysisTemplateAnnotationDocument,
      params: {
        purposeTemplateId: mockPurposeTemplateId,
        documentId: mockDocumentId,
      },
    });
  });
});
