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

describe("removeClientUser", () => {
  const userId: string = generateId();
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );

  const mockApiClient = getMockWithMetadata(getMockedApiConsumerFullClient());

  const mockremoveClientUser = vi.fn();

  const mockGetClient = vi.fn(
    mockDeletionPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
      removeUser: mockremoveClientUser,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockremoveClientUser.mockClear();
    mockGetClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await clientService.removeClientUser(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      userId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.authorizationClient.client.removeUser,
      params: {
        clientId: unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        userId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: {
        clientId: unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      },
    });
    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetClient.mockImplementation(
      mockDeletionPollingResponse(
        mockApiClient,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      clientService.removeClientUser(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        userId,
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
