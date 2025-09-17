import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  DescriptorId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiEserviceDoc,
} from "pagopa-interop-commons-test";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  eserviceService,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  eserviceDescriptorInterfaceNotFound,
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEServiceDescriptorInterface", () => {
  const mockDocument = getMockedApiEserviceDoc();
  const mockDescriptor = getMockedApiEserviceDescriptor({
    interfaceDoc: mockDocument,
  });
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor],
    technology: catalogApi.EServiceTechnology.Values.REST,
  });

  const mockGetEServiceResponse = getMockWithMetadata(mockEService, 2);

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

    await eserviceService.deleteEServiceDescriptorInterface(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockDescriptor.id),
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

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId<DescriptorId>();
    await expect(
      eserviceService.deleteEServiceDescriptorInterface(
        unsafeBrandId(mockEService.id),
        nonExistingDescriptorId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(mockEService.id, nonExistingDescriptorId)
    );
  });

  it("Should throw eserviceDescriptorInterfaceNotFound in case the returned eservice descriptor has no interface", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      data: {
        ...mockGetEServiceResponse.data,
        descriptors: [
          {
            ...mockGetEServiceResponse.data.descriptors[0],
            interface: undefined,
          },
        ],
      },
    });
    await expect(
      eserviceService.deleteEServiceDescriptorInterface(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorInterfaceNotFound(
        mockGetEServiceResponse.data.id,
        mockGetEServiceResponse.data.descriptors[0].id
      )
    );
  });

  it("Should throw missingMetadata in case the eservice returned by the document DELETE call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockDeleteEServiceDocumentById.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteEServiceDescriptorInterface(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
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
      eserviceService.deleteEServiceDescriptorInterface(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
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
      eserviceService.deleteEServiceDescriptorInterface(
        unsafeBrandId(mockGetEServiceResponse.data.id),
        unsafeBrandId(mockGetEServiceResponse.data.descriptors[0].id),
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
