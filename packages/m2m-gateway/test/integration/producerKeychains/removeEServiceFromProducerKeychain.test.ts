import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
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

describe("removeEServiceFromProducerKeychain", () => {
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiFullProducerKeychain()
  );

  const mockRemoveProducerKeychainPurpose = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetProducerKeychain = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
      removeEServiceFromProducerKeychain: mockRemoveProducerKeychainPurpose,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRemoveProducerKeychainPurpose.mockClear();
    mockGetProducerKeychain.mockClear();
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const eserviceId = generateId<EServiceId>();
    const result =
      await producerKeychainService.removeEServiceFromProducerKeychain(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        eserviceId,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.producerKeychain
          .removeProducerKeychainEService,
      params: {
        producerKeychainId: mockAuthorizationProcessResponse.data.id,
        eserviceId,
      },
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

  it("Should throw missingMetadata in case the producerKeychain returned by the removeEServiceFromProducerKeychain POST call has no metadata", async () => {
    mockRemoveProducerKeychainPurpose.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      producerKeychainService.removeEServiceFromProducerKeychain(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
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
      producerKeychainService.removeEServiceFromProducerKeychain(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
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
      producerKeychainService.removeEServiceFromProducerKeychain(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
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
