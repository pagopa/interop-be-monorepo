import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
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

describe("deleteEService", () => {
  const mockApiEService = getMockWithMetadata(getMockedApiEservice());

  const mockDeleteEService = vi.fn();
  const mockGetEService = vi.fn(
    mockDeletionPollingResponse(mockApiEService, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    deleteEService: mockDeleteEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockDeleteEService.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await eserviceService.deleteEService(
      unsafeBrandId(mockApiEService.data.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.deleteEService,
      params: { eServiceId: mockApiEService.data.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEService.data.id },
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
      eserviceService.deleteEService(
        unsafeBrandId(mockApiEService.data.id),
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
