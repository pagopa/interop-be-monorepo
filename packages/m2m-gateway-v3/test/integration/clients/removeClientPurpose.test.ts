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

describe("removeClientPurpose", () => {
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );

  const mockRemoveClientPurpose = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetClient = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
      removeClientPurpose: mockRemoveClientPurpose,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockRemoveClientPurpose.mockClear();
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockAuthorizationProcessResponse)
      .mockImplementation(
        mockPollingResponse(mockAuthorizationProcessResponse, 2)
      );
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeId = generateId();
    const result = await clientService.removeClientPurpose(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      purposeId,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.client.removeClientPurpose,
      params: {
        clientId: mockAuthorizationProcessResponse.data.id,
        purposeId,
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

  it("Should reject an API client before removing a purpose", async () => {
    const apiClient = getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.API,
    });
    mockGetClient.mockReset().mockResolvedValue(getMockWithMetadata(apiClient));

    await expect(
      clientService.removeClientPurpose(
        unsafeBrandId(apiClient.id),
        generateId(),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(clientNotFound(apiClient));

    expect(mockRemoveClientPurpose).not.toHaveBeenCalled();
  });

  it("Should throw missingMetadata in case the client returned by the removeClientPurpose POST call has no metadata", async () => {
    mockRemoveClientPurpose.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.removeClientPurpose(
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
      clientService.removeClientPurpose(
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
      clientService.removeClientPurpose(
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
