import { describe, it, vi, beforeEach, expect } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
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
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound } from "../../../src/model/errors.js";

describe("deleteEServiceDescriptorAsyncExchangeCallbackInterface", () => {
  const mockDocument = getMockedApiEserviceDoc();
  const mockDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    asyncExchangeCallbackInterface: mockDocument,
  };
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor],
    technology: catalogApi.EServiceTechnology.Values.REST,
  });

  const mockGetEServiceResponse = getMockWithMetadata(mockEService, 2);

  const mockDeleteEServiceDocumentById = vi
    .fn()
    .mockResolvedValue(mockGetEServiceResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockGetEServiceResponse, 1)
  );

  mockInteropBeClients.catalogProcessClient = {
    deleteEServiceDocumentById: mockDeleteEServiceDocumentById,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockDeleteEServiceDocumentById.mockClear();
    mockGetEService.mockClear();
  });

  it("Should delete the async exchange callback interface document", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    await eserviceService.deleteEServiceDescriptorAsyncExchangeCallbackInterface(
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
  });

  it("Should throw eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound if the descriptor has no async exchange callback interface", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      data: {
        ...mockGetEServiceResponse.data,
        descriptors: [
          {
            ...mockDescriptor,
            asyncExchangeCallbackInterface: undefined,
          },
        ],
      },
    });

    await expect(
      eserviceService.deleteEServiceDescriptorAsyncExchangeCallbackInterface(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound(
        mockEService.id,
        mockDescriptor.id
      )
    );
  });
});
