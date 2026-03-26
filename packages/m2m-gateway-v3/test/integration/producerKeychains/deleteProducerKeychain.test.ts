import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  ProducerKeychainId,
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
  mockDeletionPollingResponse,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("deleteProducerKeychain", () => {
  const mockProducerKeychain = getMockedApiFullProducerKeychain();
  const mockProducerKeychainWithMetadata = getMockWithMetadata(
    mockProducerKeychain,
    2
  );

  const keychainId = unsafeBrandId<ProducerKeychainId>(mockProducerKeychain.id);

  const mockDeleteProducerKeychain = vi.fn();
  const mockGetProducerKeychain = vi.fn(
    mockDeletionPollingResponse(mockProducerKeychainWithMetadata, 2)
  );

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      deleteProducerKeychain: mockDeleteProducerKeychain,
      getProducerKeychain: mockGetProducerKeychain,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockDeleteProducerKeychain.mockClear();
    mockGetProducerKeychain.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await producerKeychainService.deleteProducerKeychain(
      keychainId,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(undefined);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockDeleteProducerKeychain,
      params: { producerKeychainId: keychainId },
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
      mockDeletionPollingResponse(
        mockProducerKeychainWithMetadata,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      producerKeychainService.deleteProducerKeychain(
        keychainId,
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
