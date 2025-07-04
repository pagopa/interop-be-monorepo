import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiCompactClient,
  getMockedApiFullClient,
} from "pagopa-interop-commons-test";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { unexpectedClientKind } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getClient", () => {
  const mockFullClientFromProcess = getMockWithMetadata(
    getMockedApiFullClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    })
  );

  const mockCompactClientFromProcess = getMockWithMetadata(
    getMockedApiCompactClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    })
  );

  const mockGetClient = vi.fn();

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetClient.mockClear();
  });

  it("Should succeed with compact client and perform API clients calls", async () => {
    mockGetClient.mockResolvedValue(mockCompactClientFromProcess);

    const m2mClientResponse: m2mGatewayApi.Client = {
      id: mockCompactClientFromProcess.data.id,
      consumerId: mockCompactClientFromProcess.data.consumerId,
      visibility: m2mGatewayApi.ClientVisibility.Values.COMPACT,
    };

    const result = await clientService.getClient(
      unsafeBrandId(mockCompactClientFromProcess.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockCompactClientFromProcess.data.id },
    });
  });

  it("Should succeed with full client and perform API clients calls", async () => {
    mockGetClient.mockResolvedValue(mockFullClientFromProcess);

    const m2mFullClientResponse: m2mGatewayApi.FullClient = {
      id: mockFullClientFromProcess.data.id,
      consumerId: mockFullClientFromProcess.data.consumerId,
      visibility: m2mGatewayApi.ClientVisibility.Values.FULL,
      name: mockFullClientFromProcess.data.name,
      description: mockFullClientFromProcess.data.description,
      createdAt: mockFullClientFromProcess.data.createdAt,
    };

    const result = await clientService.getClient(
      unsafeBrandId(mockFullClientFromProcess.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mFullClientResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockFullClientFromProcess.data.id },
    });
  });

  it("Should throw unexpectedClientKind in case the returned client has an unexpected kind", async () => {
    const mockResponse = {
      ...mockCompactClientFromProcess,
      data: {
        ...mockCompactClientFromProcess.data,
        kind: authorizationApi.ClientKind.Values.API,
      },
    };

    mockGetClient.mockResolvedValueOnce(mockResponse);

    await expect(
      clientService.getClient(
        unsafeBrandId(mockCompactClientFromProcess.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedClientKind(mockResponse.data));

    const mockResponsFull = {
      ...mockFullClientFromProcess,
      data: {
        ...mockFullClientFromProcess.data,
        kind: authorizationApi.ClientKind.Values.API,
      },
    };

    mockGetClient.mockResolvedValueOnce(mockResponsFull);

    await expect(
      clientService.getClient(
        unsafeBrandId(mockFullClientFromProcess.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedClientKind(mockResponsFull.data));
  });
});
