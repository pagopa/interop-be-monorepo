import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
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
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEService,
} from "../../mockUtils.js";

describe("updateDraftEService", () => {
  const mockEService = getMockedApiEservice();
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockEServiceSeed: m2mGatewayApiV3.EServiceDraftUpdateSeed = {
    name: "updated name",
    description: "updated description",
    technology: "REST",
    isSignalHubEnabled: true,
    isConsumerDelegable: false,
    isClientAccessDelegable: true,
    mode: "RECEIVE",
  };

  const mockPatchUpdateEService = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessGetResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    patchUpdateDraftEServiceById: mockPatchUpdateEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPatchUpdateEService.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await eserviceService.updateDraftEService(
      unsafeBrandId(mockEService.id),
      mockEServiceSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApiV3.EService =
      testToM2mGatewayApiEService(mockEServiceProcessGetResponse.data);

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftEServiceById,
      params: {
        eServiceId: mockEService.id,
      },
      body: mockEServiceSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: "Updated metadata name" },
    { description: "Updated metadata description" },
    { name: mockEService.name, description: mockEService.description },
  ])(
    "Should forward metadata-only or no-op seed %# and poll its returned version",
    async (seed) => {
      mockGetEService.mockImplementation(
        mockPollingResponse(mockEServiceProcessGetResponse, 1)
      );
      const result = await eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        seed,
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(
        testToM2mGatewayApiEService(mockEServiceProcessGetResponse.data)
      );
      expect(mockPatchUpdateEService).toHaveBeenCalledTimes(1);
      expectApiClientPostToHaveBeenCalledWith({
        mockPost: mockPatchUpdateEService,
        params: { eServiceId: mockEService.id },
        body: seed,
      });
      expect(mockGetEService).toHaveBeenCalledTimes(1);
    }
  );

  it("Should propagate a conflict without polling or retrying", async () => {
    const error = new AxiosError(
      "Catalog conflict",
      undefined,
      undefined,
      undefined,
      {
        status: 409,
        statusText: "Conflict",
        data: {},
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );
    mockPatchUpdateEService.mockRejectedValueOnce(error);
    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toBe(error);
    expect(mockPatchUpdateEService).toHaveBeenCalledTimes(1);
    expect(mockGetEService).not.toHaveBeenCalled();
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockPatchUpdateEService.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockEServiceProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.updateDraftEService(
        unsafeBrandId(mockEService.id),
        mockEServiceSeed,
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
