import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockedApiClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  unexpectedClientKind,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createClient", () => {
  const mockClientSeed: m2mGatewayApi.ClientSeed = {
    name: generateMock(z.string().min(6).max(60)),
    description: generateMock(z.string().min(10).max(250)),
    members: [generateId(), generateId()],
  };

  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    })
  );

  const mockCreateClient = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetClient = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      createConsumerClient: mockCreateClient,
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateClient.mockClear();
    mockGetClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientResponse: m2mGatewayApi.Client = {
      id: mockAuthorizationProcessResponse.data.id,
      consumerId: mockAuthorizationProcessResponse.data.consumerId,
      name: mockAuthorizationProcessResponse.data.name,
      createdAt: mockAuthorizationProcessResponse.data.createdAt,
      description: mockAuthorizationProcessResponse.data.description,
      purposes: mockAuthorizationProcessResponse.data.purposes,
      users: mockAuthorizationProcessResponse.data.users,
    };

    const result = await clientService.createClient(
      mockClientSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.client.createConsumerClient,
      body: mockClientSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw unexpectedClientKind in case the returned client has an unexpected kind", async () => {
    const mockResponse = {
      ...mockAuthorizationProcessResponse,
      data: {
        ...mockAuthorizationProcessResponse.data,
        kind: authorizationApi.ClientKind.Values.API,
      },
    };

    mockGetClient.mockResolvedValueOnce(mockResponse);

    await expect(
      clientService.createClient(mockClientSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(unexpectedClientKind(mockResponse.data));
  });

  it("Should throw missingMetadata in case the client returned by the creation POST call has no metadata", async () => {
    mockCreateClient.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.createClient(mockClientSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the client returned by the polling GET call has no metadata", async () => {
    mockGetClient.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.createClient(mockClientSeed, getMockM2MAdminAppContext())
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
      clientService.createClient(mockClientSeed, getMockM2MAdminAppContext())
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
