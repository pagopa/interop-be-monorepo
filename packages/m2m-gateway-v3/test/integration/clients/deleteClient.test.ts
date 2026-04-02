import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ClientId,
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
  mockDeletionPollingResponse,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deleteClient", () => {
  const mockConsumerClient = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );
  const clientId: ClientId = unsafeBrandId(mockConsumerClient.data.id);

  const mockDeleteClient = vi.fn();
  const mockGetClient = vi.fn(
    mockDeletionPollingResponse(mockConsumerClient, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      deleteClient: mockDeleteClient,
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockDeleteClient.mockClear();
    mockGetClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await clientService.deleteClient(clientId, getMockM2MAdminAppContext());

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockDeleteClient,
      params: { clientId },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId },
    });

    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetClient.mockImplementation(
      mockDeletionPollingResponse(
        mockConsumerClient,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      clientService.deleteClient(clientId, getMockM2MAdminAppContext())
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
