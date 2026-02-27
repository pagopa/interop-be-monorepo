import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  ProducerKeychainId,
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
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deleteProducerKeychainKey", () => {
  const keyId = generateId();
  const mockKeychainResponse = getMockedApiFullProducerKeychain();
  const mockResponseWithMetadata = getMockWithMetadata(mockKeychainResponse);
  const keychainId = mockKeychainResponse.id as ProducerKeychainId;

  const mockDeleteProducerKeyById = vi.fn();
  const mockGetProducerKeychain = vi.fn();

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      deleteProducerKeyById: mockDeleteProducerKeyById,
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDeleteProducerKeyById.mockResolvedValue(mockResponseWithMetadata);

    mockGetProducerKeychain.mockImplementation(
      mockPollingResponse(mockResponseWithMetadata, 2)
    );
  });

  it("Should succeed and perform API producerKeychains calls", async () => {
    const result = await producerKeychainService.deleteProducerKeychainKey(
      keychainId,
      keyId,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(undefined);

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
          .getProducerKeychain,
      params: { producerKeychainId: keychainId },
    });

    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetProducerKeychain.mockImplementation(
      mockPollingResponse(
        mockResponseWithMetadata,
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

    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
