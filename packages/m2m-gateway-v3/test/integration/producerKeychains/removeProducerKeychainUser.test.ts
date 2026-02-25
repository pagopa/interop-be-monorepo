import { describe, it, expect, vi, beforeEach } from "vitest";
import {
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
  mockPollingResponse,
  mockInteropBeClients,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
} from "../../integrationUtils.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("removeProducerKeychainUser", () => {
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiFullProducerKeychain()
  );

  const mockRemoveProducerKeychainUser = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetProducerKeychain = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
      removeProducerKeychainUser: mockRemoveProducerKeychainUser,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRemoveProducerKeychainUser.mockClear();
    mockGetProducerKeychain.mockClear();
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const userId = generateId();
    const result = await producerKeychainService.removeProducerKeychainUser(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      userId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.producerKeychain
          .removeProducerKeychainUser,
      params: {
        producerKeychainId: mockAuthorizationProcessResponse.data.id,
        userId,
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

  it("Should throw missingMetadata in case the producerKeychain returned by the removeProducerKeychainUser POST call has no metadata", async () => {
    mockRemoveProducerKeychainUser.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      producerKeychainService.removeProducerKeychainUser(
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
      producerKeychainService.removeProducerKeychainUser(
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
      producerKeychainService.removeProducerKeychainUser(
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
