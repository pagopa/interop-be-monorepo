import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
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
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiClient,
} from "../../mockUtils.js";

describe("addClientPurpose", () => {
  const mockSeed: m2mGatewayApi.ClientAddPurpose = {
    purposeId: generateId(),
  };

  const mockAuthorizationProcessResponse = getMockedApiClient();

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
    // Clear mock counters and call information before each test
    mockAddClientPurpose.mockClear();
    mockGetClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientResponse: m2mGatewayApi.Client = {
      id: mockAuthorizationProcessResponse.data.id,
      name: mockAuthorizationProcessResponse.data.name,
      consumerId: mockAuthorizationProcessResponse.data.consumerId,
      adminId: mockAuthorizationProcessResponse.data.adminId,
      createdAt: mockAuthorizationProcessResponse.data.createdAt,
      purposes: mockAuthorizationProcessResponse.data.purposes,
      description: mockAuthorizationProcessResponse.data.description,
      users: mockAuthorizationProcessResponse.data.users,
      kind: mockAuthorizationProcessResponse.data.kind,
    };

    const result = await clientService.addClientPurpose(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientResponse);
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
    ).toHaveBeenCalledTimes(2);
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
    mockGetClient.mockResolvedValueOnce({
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

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetClient.mockImplementation(
      mockPollingResponse(
        mockAuthorizationProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      clientService.addClientPurpose(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetClient).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
