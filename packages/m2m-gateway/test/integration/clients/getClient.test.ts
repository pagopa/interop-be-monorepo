import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockedApiClient,
  getMockWithMetadata,
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
  const mockAuthorizationProcessResponse = getMockWithMetadata(
    getMockedApiClient({
      kind: authorizationApi.ClientKind.Values.CONSUMER,
    })
  );

  const mockGetClient = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
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

    const result = await clientService.getClient(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthorizationProcessResponse.data.id },
    });
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
      clientService.getClient(
        unsafeBrandId(mockAuthorizationProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedClientKind(mockResponse.data));
  });
});
