import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiAgreement,
  getMockedApiAgreementDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  agreementService,
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

describe("addAgreementConsumerDocument", () => {
  const mockAddDocumentResponse = getMockWithMetadata(
    getMockedApiAgreementDocument()
  );

  const mockGetAgreementResponse = getMockWithMetadata(
    getMockedApiAgreement(),
    mockAddDocumentResponse.metadata.version
  );

  const mockFileBuffer = Buffer.from("test content");
  const mockFileUpload: m2mGatewayApi.FileUploadMultipart = {
    file: new File([mockFileBuffer], mockAddDocumentResponse.data.name, {
      type: mockAddDocumentResponse.data.contentType,
    }),
    prettyName: mockAddDocumentResponse.data.prettyName,
  };

  const mockAddAgreementConsumerDocument = vi
    .fn()
    .mockResolvedValue(mockAddDocumentResponse);

  const mockGetAgreement = vi.fn(
    mockPollingResponse(mockGetAgreementResponse, 2)
  );

  mockInteropBeClients.agreementProcessClient = {
    addAgreementConsumerDocument: mockAddAgreementConsumerDocument,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddAgreementConsumerDocument.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementDocumentResponse: m2mGatewayApi.Document = {
      id: mockAddDocumentResponse.data.id,
      prettyName: mockAddDocumentResponse.data.prettyName,
      name: mockAddDocumentResponse.data.name,
      contentType: mockAddDocumentResponse.data.contentType,
      createdAt: mockAddDocumentResponse.data.createdAt,
    };

    vi.spyOn(fileManager, "storeBytes");

    const result = await agreementService.uploadAgreementConsumerDocument(
      unsafeBrandId(mockGetAgreementResponse.data.id),
      mockFileUpload,
      getMockM2MAdminAppContext()
    );

    const uuidSimpleRegex = "[a-zA-Z0-9-]+";
    const matchUUID = expect.stringMatching(`^${uuidSimpleRegex}$`);
    const matchExpectedPath = expect.stringMatching(
      `^${config.agreementConsumerDocumentsPath}/${mockGetAgreementResponse.data.id}/${uuidSimpleRegex}/${mockFileUpload.file.name}$`
    );

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: config.agreementConsumerDocumentsContainer,
        path: `${config.agreementConsumerDocumentsPath}/${mockGetAgreementResponse.data.id}`,
        resourceId: matchUUID,
        name: mockFileUpload.file.name,
        content: mockFileBuffer,
      },
      expect.any(Object) // Logger instance
    );

    expect(
      await fileManager.listFiles(
        config.agreementConsumerDocumentsContainer,
        genericLogger
      )
    ).toStrictEqual([matchExpectedPath]);

    expect(result).toStrictEqual(m2mAgreementDocumentResponse);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.agreementProcessClient
          .addAgreementConsumerDocument,
      body: {
        id: matchUUID,
        prettyName: mockFileUpload.prettyName,
        name: mockFileUpload.file.name,
        contentType: mockFileUpload.file.type,
        path: matchExpectedPath,
      },
      params: { agreementId: mockGetAgreementResponse.data.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockGetAgreementResponse.data.id },
    });
    expect(mockGetAgreement).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the data returned by the POST call has no metadata", async () => {
    mockAddAgreementConsumerDocument.mockResolvedValueOnce({
      ...mockAddDocumentResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.uploadAgreementConsumerDocument(
        unsafeBrandId(mockGetAgreementResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce({
      ...mockGetAgreementResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.uploadAgreementConsumerDocument(
        unsafeBrandId(mockGetAgreementResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockGetAgreementResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      agreementService.uploadAgreementConsumerDocument(
        unsafeBrandId(mockGetAgreementResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });

  it("Should attempt to upload document, fail the API client call, and delete the stored file", async () => {
    const mockApiError = new Error(
      "Simulated API client failure during document creation"
    );
    const mockAddAgreementConsumerDocument = vi
      .fn()
      .mockRejectedValue(mockApiError);

    mockInteropBeClients.agreementProcessClient = {
      addAgreementConsumerDocument: mockAddAgreementConsumerDocument,
      getAgreementById: vi.fn(),
    } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

    const mockStoragePath =
      "agreement-documents-container/agreements/1234/uuid-doc/test.json";
    vi.spyOn(fileManager, "storeBytes").mockResolvedValue(mockStoragePath);

    vi.spyOn(fileManager, "delete").mockResolvedValue(undefined);

    await expect(
      agreementService.uploadAgreementConsumerDocument(
        unsafeBrandId(mockGetAgreementResponse.data.id),
        mockFileUpload,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(mockApiError);

    const uuidSimpleRegex = "[a-zA-Z0-9-]+";
    const matchUUID = expect.stringMatching(`^${uuidSimpleRegex}$`);

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
      {
        bucket: config.agreementConsumerDocumentsContainer,
        path: `${config.agreementConsumerDocumentsPath}/${mockGetAgreementResponse.data.id}`,
        resourceId: matchUUID,
        name: mockFileUpload.file.name,
        content: mockFileBuffer,
      },
      expect.any(Object)
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockAddAgreementConsumerDocument,
      body: expect.objectContaining({
        id: matchUUID,
        prettyName: mockFileUpload.prettyName,
      }),
      params: { agreementId: mockGetAgreementResponse.data.id },
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.agreementConsumerDocumentsContainer,
      mockStoragePath,
      expect.any(Object)
    );

    expect(
      mockInteropBeClients.agreementProcessClient.getAgreementById
    ).not.toHaveBeenCalled();
  });
});
