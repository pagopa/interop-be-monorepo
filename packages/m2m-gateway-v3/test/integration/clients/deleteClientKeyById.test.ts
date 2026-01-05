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
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deleteClientKey", () => {
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiConsumerFullClient()
  );

  const mockDeleteClientKeyById = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetClient = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
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

  it("Should throw missingMetadata in case the client returned by the deleteClientKeyById DELETE call has no metadata", async () => {
    mockDeleteClientKeyById.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.deleteClientKey(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the client returned by the polling GET call has no metadata", async () => {
    mockGetClient.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.deleteClientKey(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        generateId(),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetClient.mockImplementation(
      mockPollingResponse(
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
