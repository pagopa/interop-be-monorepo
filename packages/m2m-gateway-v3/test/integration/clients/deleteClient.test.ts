import { authorizationApi } from "pagopa-interop-api-clients";
import {
  getMockedApiConsumerFullClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  ClientId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { clientNotFound } from "../../../src/model/errors.js";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockDeletionPollingResponse,
  mockInteropBeClients,
} from "../../integrationUtils.js";
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
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockConsumerClient)
      .mockImplementation(mockDeletionPollingResponse(mockConsumerClient, 2));
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
    ).toHaveBeenCalledTimes(3);
  });

  it("Should reject an API client before deleting", async () => {
    const apiClient = getMockWithMetadata(
      getMockedApiConsumerFullClient({
        kind: authorizationApi.ClientKind.Values.API,
      })
    );
    mockGetClient.mockReset().mockResolvedValue(apiClient);

    await expect(
      clientService.deleteClient(
        unsafeBrandId(apiClient.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(clientNotFound(apiClient.data));

    expect(mockDeleteClient).not.toHaveBeenCalled();
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockConsumerClient)
      .mockImplementation(
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
      config.defaultPollingMaxRetries + 1
    );
  });
});
