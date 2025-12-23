import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEserviceTemplateVersion,
  getMockedApiEserviceDoc,
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("uploadEServiceTemplateVersionDocument", () => {
  const mockAddDocumentResponse = getMockWithMetadata(
    getMockedApiEserviceDoc()
  );

  const mockVersion = getMockedApiEserviceTemplateVersion();

  const mockGetEServiceTemplateResponse = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [mockVersion],
    }),
    mockAddDocumentResponse.metadata.version
  );

  const mockFileBuffer = Buffer.from("test content");
  const mockFileUpload: m2mGatewayApiV3.FileUploadMultipart = {
    file: new File([mockFileBuffer], mockAddDocumentResponse.data.name, {
      type: mockAddDocumentResponse.data.contentType,
    }),
    prettyName: mockAddDocumentResponse.data.prettyName,
  };

  const mockCreateEServiceTemplateDocument = vi
    .fn()
    .mockResolvedValue(mockAddDocumentResponse);

  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockGetEServiceTemplateResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    createEServiceTemplateDocument: mockCreateEServiceTemplateDocument,
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateEServiceTemplateDocument.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    const m2mEServiceDocumentResponse: m2mGatewayApiV3.Document = {
      id: mockAddDocumentResponse.data.id,
      prettyName: mockAddDocumentResponse.data.prettyName,
      name: mockAddDocumentResponse.data.name,
      contentType: mockAddDocumentResponse.data.contentType,
      createdAt: mockAddDocumentResponse.data.uploadDate,
    };

    vi.spyOn(fileManager, "storeBytes");

    const result =
      await eserviceTemplateService.uploadEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockVersion.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      );

    const uuidSimpleRegex = "[a-zA-Z0-9-]+";
    const matchUUID = expect.stringMatching(`^${uuidSimpleRegex}$`);
    const matchExpectedPath = expect.stringMatching(
      `^${config.eserviceTemplateDocumentsPath}/${uuidSimpleRegex}/${mockFileUpload.file.name}$`
    );

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: config.eserviceTemplateDocumentsContainer,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: matchUUID,
        name: mockFileUpload.file.name,
        content: mockFileBuffer,
      },
      expect.any(Object) // Logger instance
    );

    expect(
      await fileManager.listFiles(
        config.eserviceTemplateDocumentsContainer,
        genericLogger
      )
    ).toEqual([matchExpectedPath]);

    expect(result).toEqual(m2mEServiceDocumentResponse);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .createEServiceTemplateDocument,
      body: {
        checksum: expect.any(String),
        fileName: mockFileUpload.file.name,
        documentId: matchUUID,
        prettyName: mockFileUpload.prettyName,
        contentType: mockFileUpload.file.type,
        filePath: matchExpectedPath,
        kind: eserviceTemplateApi.EServiceDocumentKind.Values.DOCUMENT,
        serverUrls: [
          // Empty since it's not the interface document
        ],
      },
      params: {
        templateId: mockGetEServiceTemplateResponse.data.id,
        templateVersionId: mockVersion.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockGetEServiceTemplateResponse.data.id },
    });
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(3);
  });

  it("Should throw missingMetadata in case the data returned by the POST call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockCreateEServiceTemplateDocument.mockResolvedValueOnce({
      ...mockAddDocumentResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.uploadEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockVersion.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.uploadEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockVersion.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        mockGetEServiceTemplateResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.uploadEServiceTemplateVersionDocument(
        unsafeBrandId(mockGetEServiceTemplateResponse.data.id),
        unsafeBrandId(mockVersion.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });
});
