import { authorizationApi } from "pagopa-interop-api-clients";
import {
  getMockedApiConsumerFullClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { clientNotFound, missingMetadata } from "../../../src/model/errors.js";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("removeClientUser", () => {
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );

  const mockRemoveClientUser = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetClient = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
      removeUser: mockRemoveClientUser,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockRemoveClientUser.mockClear();
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockAuthorizationProcessResponse)
      .mockImplementation(
        mockPollingResponse(mockAuthorizationProcessResponse, 2)
      );
  });

  it("Should succeed and perform API clients calls", async () => {
    const userId = generateId();
    const result = await clientService.removeClientUser(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      userId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.authorizationClient.client.removeUser,
      params: {
        clientId: mockAuthorizationProcessResponse.data.id,
        userId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(3);
  });

  it("Should reject an API client before removing a user", async () => {
    const apiClient = getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.API,
    });
    mockGetClient.mockReset().mockResolvedValue(getMockWithMetadata(apiClient));

    await expect(
      clientService.removeClientUser(
        unsafeBrandId(apiClient.id),
        generateId(),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(clientNotFound(apiClient));

    expect(mockRemoveClientUser).not.toHaveBeenCalled();
  });

  it("Should throw missingMetadata in case the client returned by the removeClientUser POST call has no metadata", async () => {
    mockRemoveClientUser.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.removeClientUser(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the client returned by the polling GET call has no metadata", async () => {
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockAuthorizationProcessResponse)
      .mockResolvedValueOnce({
        ...mockAuthorizationProcessResponse,
        metadata: undefined,
      });

    await expect(
      clientService.removeClientUser(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
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
      clientService.removeClientUser(
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
      config.defaultPollingMaxRetries + 1
    );
  });
});
