import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceService,
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

describe("uploadEServiceDescriptorDocument", () => {
  const mockAddDocumentResponse = getMockWithMetadata(
    getMockedApiEserviceDoc()
  );

  const mockDescriptor = getMockedApiEserviceDescriptor();

  const mockGetEServiceResponse = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockDescriptor],
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

  const mockCreateEServiceDocument = vi
    .fn()
    .mockResolvedValue(mockAddDocumentResponse);

  const mockGetEService = vi.fn(
    mockPollingResponse(mockGetEServiceResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    createEServiceDocument: mockCreateEServiceDocument,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateEServiceDocument.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    const m2mEServiceDocumentResponse: m2mGatewayApiV3.Document = {
      id: mockAddDocumentResponse.data.id,
      prettyName: mockAddDocumentResponse.data.prettyName,
      name: mockAddDocumentResponse.data.name,
      contentType: mockAddDocumentResponse.data.contentType,
      createdAt: mockAddDocumentResponse.data.uploadDate,
    };

    vi.spyOn(fileManager, "storeBytes");

    const result = await eserviceService.uploadEServiceDescriptorDocument(
      unsafeBrandId(mockGetEServiceResponse.data.id),
      unsafeBrandId(mockDescriptor.id),
      mockFileUpload,
      getMockM2MAdminAppContext()
    );

    const uuidSimpleRegex = "[a-zA-Z0-9-]+";
    const matchUUID = expect.stringMatching(`^${uuidSimpleRegex}$`);
    const matchExpectedPath = expect.stringMatching(
      `^${config.eserviceDocumentsPath}/${uuidSimpleRegex}/${mockFileUpload.file.name}$`
    );

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: config.eserviceDocumentsContainer,
        path: config.eserviceDocumentsPath,
        resourceId: matchUUID,
        name: mockFileUpload.file.name,
        content: mockFileBuffer,
      },
      expect.any(Object) // Logger instance
    );

    expect(
      await fileManager.listFiles(
        config.eserviceDocumentsContainer,
        genericLogger
      )
    ).toStrictEqual([matchExpectedPath]);

    expect(result).toStrictEqual(m2mEServiceDocumentResponse);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.createEServiceDocument,
      body: {
        checksum: expect.any(String),
        fileName: mockFileUpload.file.name,
        documentId: matchUUID,
        prettyName: mockFileUpload.prettyName,
        contentType: mockFileUpload.file.type,
        filePath: matchExpectedPath,
        kind: catalogApi.EServiceDocumentKind.Values.DOCUMENT,
        serverUrls: [
          // Empty since it's not the interface document
        ],
      },
      params: {
        eServiceId: mockGetEServiceResponse.data.id,
        descriptorId: mockDescriptor.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockGetEServiceResponse.data.id },
    });
    expect(mockGetEService).toHaveBeenCalledTimes(3);
  });

  it("Should throw missingMetadata in case the data returned by the POST call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockCreateEServiceDocument.mockResolvedValueOnce({
      ...mockAddDocumentResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.uploadEServiceDescriptorDocument(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockDescriptor.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockGetEService.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.uploadEServiceDescriptorDocument(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockDescriptor.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockGetEServiceResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.uploadEServiceDescriptorDocument(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockDescriptor.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });
});
