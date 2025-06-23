import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { getMockedApiClient } from "pagopa-interop-commons-test";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { unexpectedClientKind } from "../../../src/model/errors.js";

describe("getClients", () => {
  const mockParams: m2mGatewayApi.GetClientsQueryParams = {
    consumerId: generateId(),
    userIds: [generateId()],
    name: generateMock(z.string()),
    purposeId: generateId(),
    offset: 0,
    limit: 10,
  };

  const mockClient1 = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockClient2 = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

  const mockClients = [mockClient1, mockClient2];

  const mockAuthorizationProcessResponse: WithMaybeMetadata<authorizationApi.Clients> =
    {
      data: {
        results: mockClients,
        totalCount: mockClients.length,
      },
      metadata: undefined,
    };

  const mockGetClients = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  mockInteropBeClients.authorizationClient = {
    client: {
      getClients: mockGetClients,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetClients.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientResponse1: m2mGatewayApi.Client = {
      id: mockClient1.id,
      consumerId: mockClient1.consumerId,
      name: mockClient1.name,
      createdAt: mockClient1.createdAt,
      description: mockClient1.description,
      purposes: mockClient1.purposes,
      users: mockClient1.users,
    };
    const m2mClientResponse2: m2mGatewayApi.Client = {
      id: mockClient2.id,
      consumerId: mockClient2.consumerId,
      name: mockClient2.name,
      createdAt: mockClient2.createdAt,
      description: mockClient2.description,
      purposes: mockClient2.purposes,
      users: mockClient2.users,
    };

    const m2mClientsResponse: m2mGatewayApi.Clients = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockAuthorizationProcessResponse.data.totalCount,
      },
      results: [m2mClientResponse1, m2mClientResponse2],
    };

    const result = await clientService.getClients(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClients,
      queries: {
        kind: authorizationApi.ClientKind.Values.CONSUMER,
        consumerId: mockParams.consumerId,
        userIds: mockParams.userIds,
        name: mockParams.name,
        purposeId: mockParams.purposeId,
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });

  it("Should throw unexpectedClientKind in case the returned client has an unexpected kind", async () => {
    const mockBadClient = {
      ...mockClient1,
      kind: authorizationApi.ClientKind.Values.API,
    };
    const mockResponse = {
      ...mockAuthorizationProcessResponse,
      data: {
        ...mockAuthorizationProcessResponse.data,
        results: [
          ...mockAuthorizationProcessResponse.data.results,
          mockBadClient,
        ],
      },
    };

    mockInteropBeClients.authorizationClient.client.getClients =
      mockGetClients.mockResolvedValueOnce(mockResponse);

    await expect(
      clientService.getClients(mockParams, getMockM2MAdminAppContext())
    ).rejects.toThrowError(unexpectedClientKind(mockBadClient));
  });
});
