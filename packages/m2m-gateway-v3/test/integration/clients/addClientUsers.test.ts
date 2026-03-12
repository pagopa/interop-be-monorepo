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
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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

describe("addClientUsers", () => {
  const linkUser: m2mGatewayApiV3.LinkUser = {
    userId: generateId(),
  };

  const mockAuthorizationProcessResponse = getMockWithMetadata({
    ...getMockedApiConsumerFullClient(),
    users: [linkUser.userId],
  });

  const mockAddClientUsers = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetClient = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
      addUsers: mockAddClientUsers,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddClientUsers.mockClear();
    mockGetClient.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await clientService.addClientUsers(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      linkUser.userId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.authorizationClient.client.addUsers,
      params: {
        clientId: mockAuthorizationProcessResponse.data.id,
      },
      body: { userIds: [linkUser.userId] },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.client.getClient
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the client returned by the addClientUsers POST call has no metadata", async () => {
    mockAddClientUsers.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(
      clientService.addClientUsers(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        linkUser.userId,
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
      clientService.addClientUsers(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        linkUser.userId,
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
      clientService.addClientUsers(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        linkUser.userId,
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
