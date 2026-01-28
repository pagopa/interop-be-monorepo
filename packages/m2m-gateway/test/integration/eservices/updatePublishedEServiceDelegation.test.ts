import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
  randomBoolean,
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

describe("updatePublishedEServiceDelegation", () => {
  const mockEService = getMockedApiEservice();
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockSeed: m2mGatewayApi.EServiceDelegationUpdateSeed = {
    isClientAccessDelegable: randomBoolean(),
    isConsumerDelegable: randomBoolean(),
  };

  const pollingTentatives = 2;
  const mockUpdateEServiceDelegation = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessGetResponse, pollingTentatives)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    updateEServiceDelegationFlags: mockUpdateEServiceDelegation,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockUpdateEServiceDelegation.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);

    const result = await eserviceService.updatePublishedEServiceDelegation(
      unsafeBrandId(mockEService.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApi.EService = {
      id: mockEService.id,
      name: mockEService.name,
      producerId: mockEService.producerId,
      description: mockEService.description,
      technology: mockEService.technology,
      mode: mockEService.mode,
      isSignalHubEnabled: mockEService.isSignalHubEnabled,
      isClientAccessDelegable: mockEService.isClientAccessDelegable,
      isConsumerDelegable: mockEService.isConsumerDelegable,
      templateId: mockEService.templateId,
    };

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.updateEServiceDelegationFlags,
      params: {
        eServiceId: mockEService.id,
      },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: pollingTentatives + 1,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(pollingTentatives + 1);
  });

  it.each([
    {
      isClientAccessDelegable: randomBoolean(),
    },
    {
      isConsumerDelegable: randomBoolean(),
    },
    {},
  ])("Should apply patch logic when seed is partial", async (seed) => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);

    const result = await eserviceService.updatePublishedEServiceDelegation(
      unsafeBrandId(mockEService.id),
      seed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApi.EService = {
      id: mockEService.id,
      name: mockEService.name,
      producerId: mockEService.producerId,
      description: mockEService.description,
      technology: mockEService.technology,
      mode: mockEService.mode,
      isSignalHubEnabled: mockEService.isSignalHubEnabled,
      isClientAccessDelegable: mockEService.isClientAccessDelegable,
      isConsumerDelegable: mockEService.isConsumerDelegable,
      templateId: mockEService.templateId,
    };

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.updateEServiceDelegationFlags,
      params: {
        eServiceId: mockEService.id,
      },
      body: {
        isConsumerDelegable:
          seed.isConsumerDelegable ?? mockEService.isConsumerDelegable,
        isClientAccessDelegable:
          seed.isClientAccessDelegable ?? mockEService.isClientAccessDelegable,
      },
    });
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);
    mockUpdateEServiceDelegation.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updatePublishedEServiceDelegation(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockResolvedValueOnce({
        ...mockEServiceProcessGetResponse,
        metadata: undefined,
      });

    await expect(
      eserviceService.updatePublishedEServiceDelegation(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(
          mockEServiceProcessGetResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      eserviceService.updatePublishedEServiceDelegation(
        unsafeBrandId(mockEService.id),
        mockSeed,
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
