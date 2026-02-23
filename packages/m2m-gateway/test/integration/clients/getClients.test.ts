import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiConsumerPartialClient,
  getMockedApiConsumerFullClient,
} from "pagopa-interop-commons-test";
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
    name: generateMock(z.string()),
    offset: 0,
    limit: 10,
  };
  const mockFullClient1 = getMockedApiConsumerFullClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockFullClient2 = getMockedApiConsumerFullClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

  const mockFullClients = [mockFullClient1, mockFullClient2];

  const mockFullClientsResponse: WithMaybeMetadata<authorizationApi.Clients> = {
    data: {
      results: mockFullClients,
      totalCount: mockFullClients.length,
    },
    metadata: undefined,
  };

  const mockGetClients = vi.fn();

  const mockPartialClient1 = getMockedApiConsumerPartialClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockPartialClient2 = getMockedApiConsumerPartialClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockPartialClients = [mockPartialClient1, mockPartialClient2];
  const mockPartialClientsResponse: WithMaybeMetadata<authorizationApi.Clients> =
    {
      data: {
        results: mockPartialClients,
        totalCount: mockPartialClients.length,
      },
      metadata: undefined,
    };

  mockInteropBeClients.authorizationClient = {
    client: {
      getClients: mockGetClients,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetClients.mockClear();
  });

  it("Should succeed with full clients and perform API clients calls", async () => {
    mockGetClients.mockResolvedValueOnce(mockFullClientsResponse);

    const m2mClientResponse1: m2mGatewayApi.FullClient = {
      id: mockFullClient1.id,
      consumerId: mockFullClient1.consumerId,
      name: mockFullClient1.name,
      createdAt: mockFullClient1.createdAt,
      description: mockFullClient1.description,
    };
    const m2mClientResponse2: m2mGatewayApi.FullClient = {
      id: mockFullClient2.id,
      consumerId: mockFullClient2.consumerId,
      name: mockFullClient2.name,
      createdAt: mockFullClient2.createdAt,
      description: mockFullClient2.description,
    };

    const m2mClientsResponse: m2mGatewayApi.Clients = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockFullClientsResponse.data.totalCount,
      },
      results: [m2mClientResponse1, m2mClientResponse2],
    };

    const result = await clientService.getClients(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mClientsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClients,
      queries: {
        kind: authorizationApi.ClientKind.Values.CONSUMER,
        consumerId: mockParams.consumerId,
        name: mockParams.name,
        offset: mockParams.offset,
        limit: mockParams.limit,
        userIds: [],
        purposeId: undefined,
      },
    });
  });

  it("Should succeed with partial clients and perform API clients calls", async () => {
    mockGetClients.mockResolvedValueOnce(mockPartialClientsResponse);

    const m2mClientResponse1: m2mGatewayApi.PartialClient = {
      id: mockPartialClient1.id,
      consumerId: mockPartialClient1.consumerId,
    };
    const m2mClientResponse2: m2mGatewayApi.PartialClient = {
      id: mockPartialClient2.id,
      consumerId: mockPartialClient2.consumerId,
    };

    const m2mClientsResponse: m2mGatewayApi.Clients = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPartialClientsResponse.data.totalCount,
      },
      results: [m2mClientResponse1, m2mClientResponse2],
    };

    const result = await clientService.getClients(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mClientsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClients,
      queries: {
        kind: authorizationApi.ClientKind.Values.CONSUMER,
        consumerId: mockParams.consumerId,
        name: mockParams.name,
        offset: mockParams.offset,
        limit: mockParams.limit,
        userIds: [],
        purposeId: undefined,
      },
    });
  });

  it("Should throw unexpectedClientKind in case the returned client has an unexpected kind", async () => {
    const mockBadClientPartial = {
      ...mockPartialClient1,
      kind: authorizationApi.ClientKind.Values.API,
    };
    const mockResponsePartial = {
      ...mockPartialClientsResponse,
      data: {
        ...mockPartialClientsResponse.data,
        results: [
          ...mockPartialClientsResponse.data.results,
          mockBadClientPartial,
        ],
      },
    };

    mockInteropBeClients.authorizationClient.client.getClients =
      mockGetClients.mockResolvedValueOnce(mockResponsePartial);

    await expect(
      clientService.getClients(mockParams, getMockM2MAdminAppContext())
    ).rejects.toThrowError(unexpectedClientKind(mockBadClientPartial));

    const mockBadClientFull = {
      ...mockFullClient1,
      kind: authorizationApi.ClientKind.Values.API,
    };
    const mockResponseFull = {
      ...mockFullClientsResponse,
      data: {
        ...mockFullClientsResponse.data,
        results: [...mockFullClientsResponse.data.results, mockBadClientFull],
      },
    };

    mockInteropBeClients.authorizationClient.client.getClients =
      mockGetClients.mockResolvedValueOnce(mockResponseFull);
    await expect(
      clientService.getClients(mockParams, getMockM2MAdminAppContext())
    ).rejects.toThrowError(unexpectedClientKind(mockBadClientFull));
  });
});
