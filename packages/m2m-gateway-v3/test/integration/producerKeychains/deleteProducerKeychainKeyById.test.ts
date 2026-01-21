import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  ProducerKeychainId,
} from "pagopa-interop-models";
import {
  getMockedApiFullProducerKeychain,
  getMockWithMetadata,
  getMockedApiKey,
} from "pagopa-interop-commons-test";
import {
  producerKeychainService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockDeletionPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deleteProducerKeychainKey", () => {
  const keyId = generateId();
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiFullProducerKeychain()
  );
  const keychainId = mockAuthorizationProcessResponse.data
    .id as ProducerKeychainId;

  const mockApiProducerKeychainKey = getMockWithMetadata(
    getMockedApiKey({
      kid: keyId,
    })
  );

  const mockDeleteProducerKeyById = vi.fn();

  const mockGetProducerKeychain = vi.fn(
    mockDeletionPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  const mockGetProducerKeyById = vi.fn(
    mockDeletionPollingResponse(mockApiProducerKeychainKey, 2)
  );

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
      deleteProducerKeyById: mockDeleteProducerKeyById,
      getProducerKeyById: mockGetProducerKeyById,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockDeleteProducerKeyById.mockClear();
    mockGetProducerKeychain.mockClear();
    mockGetProducerKeyById.mockClear();
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const result = await producerKeychainService.deleteProducerKeychainKey(
      keychainId,
      keyId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.producerKeychain
          .deleteProducerKeyById,
      params: {
        producerKeychainId: keychainId,
        keyId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeyById,
      params: { producerKeychainId: keychainId, keyId },
    });
    expect(
      mockInteropBeClients.authorizationClient.producerKeychain
        .getProducerKeyById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetProducerKeyById.mockImplementation(
      mockDeletionPollingResponse(
        mockApiProducerKeychainKey,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      producerKeychainService.deleteProducerKeychainKey(
        keychainId,
        keyId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetProducerKeyById).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
