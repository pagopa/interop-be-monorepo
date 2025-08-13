import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiEserviceDoc,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEServiceDescriptorDocument", () => {
  const mockDocument = getMockedApiEserviceDoc();
  const mockDescriptor = { ...getMockedApiEserviceDescriptor(), docs: [] };
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor],
  });

  const mockGetEServiceResponse = getMockWithMetadata(mockEService);

  const mockDeleteEServiceDocumentById = vi
    .fn()
    .mockResolvedValue(mockGetEServiceResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockGetEServiceResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    deleteEServiceDocumentById: mockDeleteEServiceDocumentById,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockDeleteEServiceDocumentById.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    await eserviceService.deleteEServiceDescriptorDocument(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockDescriptor.id),
      unsafeBrandId(mockDocument.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.deleteEServiceDocumentById,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
        documentId: mockDocument.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
  });

  it("Should throw missingMetadata in case the eservice returned by the document DELETE call has no metadata", async () => {
    mockDeleteEServiceDocumentById.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteEServiceDescriptorDocument(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteEServiceDescriptorDocument(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockGetEServiceResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.deleteEServiceDescriptorDocument(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
