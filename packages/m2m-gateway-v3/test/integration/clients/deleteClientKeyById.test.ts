import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiConsumerFullClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockDeletionPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deleteClientKey", () => {
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );

  const mockDeleteClientKeyById = vi.fn();

  const mockGetClient = vi.fn(
    mockDeletionPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
      deleteClientKeyById: mockDeleteClientKeyById,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockDeleteClientKeyById.mockClear();
    mockGetClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const keyId = generateId();
    const result = await clientService.deleteClientKey(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      keyId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.client.deleteClientKeyById,
      params: {
        clientId: mockAuthorizationProcessResponse.data.id,
        keyId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetClient.mockImplementation(
      mockDeletionPollingResponse(
        mockAuthorizationProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      clientService.deleteClientKey(
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
    expect(mockGetClient).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
