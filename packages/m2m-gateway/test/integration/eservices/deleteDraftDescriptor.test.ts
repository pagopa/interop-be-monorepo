import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockDeletionPollingResponse,
  mockInteropBeClients,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("deleteDfratDescriptor", () => {
  const mockApiDescriptorPublished: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "PUBLISHED",
  };

  const mockApiDescriptorDraft: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "DRAFT",
  };
  const mockApiEService = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiDescriptorPublished, mockApiDescriptorDraft],
    })
  );
  const mockApiEServiceWithoutDraftDescriptor = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiDescriptorPublished],
    })
  );

  const mockM2MEserviceResponse = toM2MGatewayApiEService(
    mockApiEServiceWithoutDraftDescriptor.data
  );

  const mockDeleteDraftDescriptor = vi.fn();

  const mockGetEService = vi.fn(
    mockDeletionPollingResponse(mockApiEService, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    deleteDraft: mockDeleteDraftDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockDeleteDraftDescriptor.mockClear();
    mockGetEService.mockClear();
  });

  it.only("Should succeed and perform API clients calls and returned the Eservice", async () => {
    const mockDeleteDraftDescriptor = vi
      .fn()
      .mockResolvedValue(mockApiEServiceWithoutDraftDescriptor);
    mockInteropBeClients.catalogProcessClient = {
      getEServiceById: mockGetEService,
      deleteDraft: mockDeleteDraftDescriptor,
    } as unknown as PagoPAInteropBeClients["catalogProcessClient"];
    const eservice = await eserviceService.deleteDraftDescriptor(
      unsafeBrandId(mockApiEService.data.id),
      unsafeBrandId(mockApiDescriptorDraft.id),
      getMockM2MAdminAppContext()
    );

    expect(eservice).toEqual(mockM2MEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.deleteDraft,
      params: {
        eServiceId: mockApiEService.data.id,
        descriptorId: mockApiDescriptorDraft.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: {
        eServiceId: mockApiEService.data.id,
      },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });

  it("Should succeed and perform API clients calls", async () => {
    await eserviceService.deleteDraftDescriptor(
      unsafeBrandId(mockApiEService.data.id),
      unsafeBrandId(mockApiDescriptorDraft.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.deleteDraft,
      params: {
        eServiceId: mockApiEService.data.id,
        descriptorId: mockApiDescriptorDraft.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: {
        eServiceId: mockApiEService.data.id,
      },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockDeletionPollingResponse(
        mockApiEService,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.deleteDraftDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiDescriptorDraft.id),
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
