import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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

describe("addClientPurpose", () => {
  const mockSeed: m2mGatewayApiV3.ClientAddPurpose = {
    purposeId: generateId(),
  };

  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );

  const mockAddClientPurpose = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetClient = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
      addClientPurpose: mockAddClientPurpose,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockAddClientPurpose.mockClear();
    mockGetClient
      .mockReset()
      .mockResolvedValueOnce(mockAuthorizationProcessResponse)
      .mockImplementation(
        mockPollingResponse(mockAuthorizationProcessResponse, 2)
      );
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await clientService.addClientPurpose(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.client.addClientPurpose,
      params: {
        clientId: mockAuthorizationProcessResponse.data.id,
      },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(3);
  });

  it("Should reject an API client before adding a purpose", async () => {
    const apiClient = getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.API,
    });
    mockGetClient.mockReset().mockResolvedValue(getMockWithMetadata(apiClient));

    await expect(
      clientService.addClientPurpose(
        unsafeBrandId(apiClient.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(clientNotFound(apiClient));

    expect(mockAddClientPurpose).not.toHaveBeenCalled();
  });

  it("Should throw missingMetadata in case the client returned by the addClientPurpose POST call has no metadata", async () => {
    mockAddClientPurpose.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.addClientPurpose(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
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
      clientService.addClientPurpose(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
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
      clientService.addClientPurpose(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
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
