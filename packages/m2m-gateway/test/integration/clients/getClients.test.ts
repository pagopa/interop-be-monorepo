import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiCompactClient,
  getMockedApiFullClient,
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
    userIds: [generateId()],
    name: generateMock(z.string()),
    purposeId: generateId(),
    offset: 0,
    limit: 10,
  };
  const mockFullClient1 = getMockedApiFullClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockFullClient2 = getMockedApiFullClient({
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

  const mockCompactClient1 = getMockedApiCompactClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockCompactClient2 = getMockedApiCompactClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockCompactClients = [mockCompactClient1, mockCompactClient2];
  const mockCompactClientsResponse: WithMaybeMetadata<authorizationApi.Clients> =
    {
      data: {
        results: mockCompactClients,
        totalCount: mockCompactClients.length,
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

    const m2mClientResponse1: m2mGatewayApi.Client = {
      visibility: m2mGatewayApi.ClientVisibility.Values.FULL,
      id: mockFullClient1.id,
      consumerId: mockFullClient1.consumerId,
      name: mockFullClient1.name,
      createdAt: mockFullClient1.createdAt,
      description: mockFullClient1.description,
    };
    const m2mClientResponse2: m2mGatewayApi.Client = {
      visibility: m2mGatewayApi.ClientVisibility.Values.FULL,
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

  it("Should succeed with compact clients and perform API clients calls", async () => {
    mockGetClients.mockResolvedValueOnce(mockCompactClientsResponse);

    const m2mClientResponse1: m2mGatewayApi.CompactClient = {
      visibility: m2mGatewayApi.ClientVisibility.Values.COMPACT,
      id: mockCompactClient1.id,
      consumerId: mockCompactClient1.consumerId,
    };
    const m2mClientResponse2: m2mGatewayApi.CompactClient = {
      visibility: m2mGatewayApi.ClientVisibility.Values.COMPACT,
      id: mockCompactClient2.id,
      consumerId: mockCompactClient2.consumerId,
    };

    const m2mClientsResponse: m2mGatewayApi.Clients = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockCompactClientsResponse.data.totalCount,
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
    const mockBadClientCompact = {
      ...mockCompactClient1,
      kind: authorizationApi.ClientKind.Values.API,
    };
    const mockResponseCompact = {
      ...mockCompactClientsResponse,
      data: {
        ...mockCompactClientsResponse.data,
        results: [
          ...mockCompactClientsResponse.data.results,
          mockBadClientCompact,
        ],
      },
    };

    mockInteropBeClients.authorizationClient.client.getClients =
      mockGetClients.mockResolvedValueOnce(mockResponseCompact);

    await expect(
      clientService.getClients(mockParams, getMockM2MAdminAppContext())
    ).rejects.toThrowError(unexpectedClientKind(mockBadClientCompact));

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
