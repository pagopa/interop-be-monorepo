import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiFullProducerKeychain,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("addProducerKeychainEService", () => {
  const mockSeed: m2mGatewayApiV3.ProducerKeychainAddEService = {
    eserviceId: generateId(),
  };

  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiFullProducerKeychain()
  );

  const mockAddProducerKeychainEService = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetProducerKeychain = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
      addProducerKeychainEService: mockAddProducerKeychainEService,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddProducerKeychainEService.mockClear();
    mockGetProducerKeychain.mockClear();
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const result = await producerKeychainService.addProducerKeychainEService(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.producerKeychain
          .addProducerKeychainEService,
      params: {
        producerKeychainId: mockAuthorizationProcessResponse.data.id,
      },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychain,
      params: { producerKeychainId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.producerKeychain
        .getProducerKeychain
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the producerKeychain returned by the addProducerKeychainEService POST call has no metadata", async () => {
    mockAddProducerKeychainEService.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      producerKeychainService.addProducerKeychainEService(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the producerKeychain returned by the polling GET call has no metadata", async () => {
    mockGetProducerKeychain.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      producerKeychainService.addProducerKeychainEService(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetProducerKeychain.mockImplementation(
      mockPollingResponse(
        mockAuthorizationProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      producerKeychainService.addProducerKeychainEService(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
