import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  eserviceService,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

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
    ).toHaveBeenCalledTimes(pollingAttempts);
  });

  it("Should throw missingMetadata in case the eservice returned by the DELETE call has no metadata", async () => {
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
    mockGetEService.mockResolvedValueOnce({
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
    mockGetEService.mockImplementation(
      mockPollingResponse(mockApiEService, config.defaultPollingMaxRetries + 1)
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
      config.defaultPollingMaxRetries
    );
  });
});
