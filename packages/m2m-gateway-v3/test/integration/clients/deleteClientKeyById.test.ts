import { authorizationApi } from "pagopa-interop-api-clients";
import {
  getMockedApiConsumerFullClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  ClientId,
  generateId,
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
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deleteClientKey", () => {
  const keyId = generateId();
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );
  const clientId: ClientId = unsafeBrandId(
    mockAuthorizationProcessResponse.data.id
  );

  const mockDeleteClientKeyById = vi.fn();
  const mockGetClient = vi.fn();

  mockInteropBeClients.authorizationClient = {
    client: {
      deleteClientKeyById: mockDeleteClientKeyById,
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDeleteClientKeyById.mockResolvedValue(mockAuthorizationProcessResponse);
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockAuthorizationProcessResponse)
      .mockImplementation(
        mockPollingResponse(mockAuthorizationProcessResponse, 2)
      );
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await clientService.deleteClientKey(
      clientId,
      keyId,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(undefined);

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.client.deleteClientKeyById,
      params: {
        clientId,
        keyId,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId },
    });

    expect(mockGetClient).toHaveBeenCalledTimes(3);
  });

  it("Should reject an API client before deleting a key", async () => {
    const apiClient = getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.API,
    });
    mockGetClient.mockReset().mockResolvedValue(getMockWithMetadata(apiClient));

    await expect(
      clientService.deleteClientKey(
        unsafeBrandId(apiClient.id),
        keyId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(clientNotFound(apiClient));

    expect(mockDeleteClientKeyById).not.toHaveBeenCalled();
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockAuthorizationProcessResponse)
      .mockImplementation(
        mockPollingResponse(
          mockAuthorizationProcessResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      clientService.deleteClientKey(
        clientId,
        keyId,
        getMockM2MAdminAppContext()
      )
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
