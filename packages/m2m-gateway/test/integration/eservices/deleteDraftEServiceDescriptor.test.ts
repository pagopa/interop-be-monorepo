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
import {
  cannotDeleteLastEServiceDescriptor,
  missingMetadata,
} from "../../../src/model/errors.js";

describe("deleteDraftEServiceDescriptor", () => {
  const mockApiEserviceDescriptor1 = getMockedApiEserviceDescriptor();
  const mockApiEserviceDescriptor2 = getMockedApiEserviceDescriptor();
  const mockApiEService = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiEserviceDescriptor1, mockApiEserviceDescriptor2],
    })
  );

  const mockDeleteDraft = vi.fn().mockResolvedValue(mockApiEService);

  const pollingAttempts = 2;
  const mockGetEService = vi.fn(
    mockPollingResponse(mockApiEService, pollingAttempts)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    deleteDraft: mockDeleteDraft,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockDeleteDraft.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEService.mockResolvedValueOnce(mockApiEService);
    // ^ The service first retrieves the eservice to make the check on last descriptor

    await eserviceService.deleteDraftEServiceDescriptor(
      unsafeBrandId(mockApiEService.data.id),
      unsafeBrandId(mockApiEserviceDescriptor1.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.deleteDraft,
      params: {
        eServiceId: mockApiEService.data.id,
        descriptorId: mockApiEserviceDescriptor1.id,
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
    ).toHaveBeenCalledTimes(pollingAttempts + 1);
  });

  it("Should throw cannotDeleteLastEServiceDescriptor when trying to delete the descriptor", async () => {
    mockGetEService.mockResolvedValueOnce(
      getMockWithMetadata({
        ...mockApiEService.data,
        descriptors: [mockApiEserviceDescriptor1],
      })
    );

    await expect(
      eserviceService.deleteDraftEServiceDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiEserviceDescriptor1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      cannotDeleteLastEServiceDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiEserviceDescriptor1.id)
      )
    );
  });

  it("Should throw missingMetadata in case the eservice returned by the DELETE call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockApiEService);
    mockDeleteDraft.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteDraftEServiceDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiEserviceDescriptor1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockApiEService)
      .mockResolvedValueOnce({
        data: mockApiEService.data,
        metadata: undefined,
      });

    await expect(
      eserviceService.deleteDraftEServiceDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiEserviceDescriptor1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockApiEService)
      .mockImplementation(
        mockPollingResponse(
          mockApiEService,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      eserviceService.deleteDraftEServiceDescriptor(
        unsafeBrandId(mockApiEService.data.id),
        unsafeBrandId(mockApiEserviceDescriptor1.id),
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
