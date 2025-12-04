import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockedApiPurposeTemplate,
  getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  invalidDocumentDetected,
  pollingMaxRetriesExceeded,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
  mockPollingResponse,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("uploadRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  const mockDocumentId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();
  const mockAnswerId = generateId<RiskAnalysisSingleAnswerId>();
  const mockDocumentName = "doc.pdf";
  const mockDocument = getMockedApiRiskAnalysisTemplateAnswerAnnotationDocument(
    {
      id: mockDocumentId,
      path: `${config.purposeTemplateDocumentsPath}/${mockDocumentId}/${mockDocumentName}`,
      name: mockDocumentName,
    }
  );

  const mockVersion = 2;
  const mockPurposeTemplateProcessResponse = getMockWithMetadata(
    mockDocument,
    mockVersion
  );

  const mockFileBuffer = Buffer.from("test content");
  const mockFileUpload: m2mGatewayApi.RiskAnalysisTemplateAnnotationDocumentUploadMultipart =
    {
      file: new File(
        [mockFileBuffer],
        mockPurposeTemplateProcessResponse.data.name,
        {
          type: mockPurposeTemplateProcessResponse.data.contentType,
        }
      ),
      prettyName: mockPurposeTemplateProcessResponse.data.prettyName,
      answerId: mockAnswerId,
    };

  const mockAddRiskAnalysisTemplateAnswerAnnotationDocument = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessResponse);

  const mockPollRetries = 2;
  const mockPurposeTemplate = getMockedApiPurposeTemplate();
  const mockGetPurposeTemplateResponse = getMockWithMetadata(
    mockPurposeTemplate,
    mockVersion
  );
  const mockGetPurposeTemplate = vi.fn(
    mockPollingResponse(mockGetPurposeTemplateResponse, mockPollRetries)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    addRiskAnalysisTemplateAnswerAnnotationDocument:
      mockAddRiskAnalysisTemplateAnswerAnnotationDocument,
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddRiskAnalysisTemplateAnswerAnnotationDocument.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEServiceDocumentResponse: m2mGatewayApi.Document = {
      id: mockPurposeTemplateProcessResponse.data.id,
      prettyName: mockPurposeTemplateProcessResponse.data.prettyName,
      name: mockPurposeTemplateProcessResponse.data.name,
      contentType: mockPurposeTemplateProcessResponse.data.contentType,
      createdAt: mockPurposeTemplateProcessResponse.data.createdAt,
    };

    vi.spyOn(fileManager, "storeBytes");

    const result =
      await purposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument(
        unsafeBrandId(mockPurposeTemplateProcessResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      );

    const uuidSimpleRegex = "[a-zA-Z0-9-]+";
    const matchUUID = expect.stringMatching(`^${uuidSimpleRegex}$`);
    const matchExpectedPath = expect.stringMatching(
      `^${config.purposeTemplateDocumentsPath}/${uuidSimpleRegex}/${mockFileUpload.file.name}$`
    );

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: config.purposeTemplateDocumentsContainer,
        path: config.purposeTemplateDocumentsPath,
        resourceId: matchUUID,
        name: mockFileUpload.file.name,
        content: mockFileBuffer,
      },
      expect.any(Object) // Logger instance
    );

    expect(
      await fileManager.listFiles(
        config.purposeTemplateDocumentsContainer,
        genericLogger
      )
    ).toEqual([matchExpectedPath]);

    expect(result).toEqual(m2mEServiceDocumentResponse);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .addRiskAnalysisTemplateAnswerAnnotationDocument,
      body: {
        documentId: matchUUID,
        prettyName: mockFileUpload.prettyName,
        name: mockFileUpload.file.name,
        path: matchExpectedPath,
        contentType: mockFileUpload.file.type,
        checksum: expect.any(String),
      },
      params: {
        id: mockPurposeTemplateProcessResponse.data.id,
        answerId: mockAnswerId,
      },
    });
    expect(
      mockAddRiskAnalysisTemplateAnswerAnnotationDocument
    ).toHaveBeenCalledOnce();

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: mockPurposeTemplateProcessResponse.data.id },
    });
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(mockPollRetries);
  });

  it("Should throw invalidDocumentDetected in case the file user is trying to upload is not a .pdf document", async () => {
    const mockFileUpload: m2mGatewayApi.RiskAnalysisTemplateAnnotationDocumentUploadMultipart =
      {
        file: new File(
          [mockFileBuffer],
          mockPurposeTemplateProcessResponse.data.name,
          {
            type: "application/json",
          }
        ),
        prettyName: mockPurposeTemplateProcessResponse.data.prettyName,
        answerId: mockAnswerId,
      };

    await expect(
      purposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument(
        unsafeBrandId(mockPurposeTemplateProcessResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(invalidDocumentDetected(mockDocumentId));
  });

  it("Should throw missingMetadata in case the data returned by the POST call has no metadata", async () => {
    mockAddRiskAnalysisTemplateAnswerAnnotationDocument.mockResolvedValueOnce({
      ...mockPurposeTemplateProcessResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument(
        unsafeBrandId(mockPurposeTemplateProcessResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetPurposeTemplate.mockResolvedValueOnce({
      ...mockGetPurposeTemplateResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument(
        unsafeBrandId(mockPurposeTemplateProcessResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockPollingResponse(
        mockGetPurposeTemplateResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument(
        unsafeBrandId(mockPurposeTemplateProcessResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
