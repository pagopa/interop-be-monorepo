import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
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
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftEService", () => {
  const mockEService = getMockedApiEservice();
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockEServiceSeed: m2mGatewayApi.EServiceDraftUpdateSeed = {
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
    patchUpdateEServiceById: mockPatchUpdateEService,
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

    const expectedM2MEService: m2mGatewayApi.EService = {
      id: mockEServiceProcessGetResponse.data.id,
      name: mockEServiceProcessGetResponse.data.name,
      producerId: mockEServiceProcessGetResponse.data.producerId,
      description: mockEServiceProcessGetResponse.data.description,
      technology: mockEServiceProcessGetResponse.data.technology,
      mode: mockEServiceProcessGetResponse.data.mode,
      isSignalHubEnabled:
        mockEServiceProcessGetResponse.data.isSignalHubEnabled,
      isClientAccessDelegable:
        mockEServiceProcessGetResponse.data.isClientAccessDelegable,
      isConsumerDelegable:
        mockEServiceProcessGetResponse.data.isConsumerDelegable,
      templateId: mockEServiceProcessGetResponse.data.templateId,
    };

    expect(result).toEqual(expectedM2MEService);
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
