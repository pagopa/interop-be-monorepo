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
  mockInteropBeClients,
  eserviceService,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";

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

  const mockDeleteDraftDescriptor = vi.fn().mockResolvedValue(mockApiEService);

  const mockGetEService = vi.fn(mockPollingResponse(mockApiEService, 2));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    deleteDraft: mockDeleteDraftDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockDeleteDraftDescriptor.mockClear();
    mockGetEService.mockClear();
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

  it("Should throw missingMetadata in case the E-Service returned by the DELETE call has no metadata", async () => {
    mockDeleteDraftDescriptor.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteDraftDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiDescriptorDraft.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the E-Service returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      data: mockApiEService.data,
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteDraftDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiDescriptorDraft.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(mockApiEService, config.defaultPollingMaxRetries + 1)
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
