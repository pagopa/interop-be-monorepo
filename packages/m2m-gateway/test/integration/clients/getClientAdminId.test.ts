import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockM2MAdminAppContext,
  getMockedApiClient,
} from "../../mockUtils.js";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { clientAdminIdNotFound } from "../../../src/model/errors.js";

describe("getClientAdminId", () => {
  const mockAuthProcessResponseWithAdminId = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.API,
  });

  const mockAuthProcessResponseWithoutAdminId = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

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

  it("Should succeed and perform API clients calls", async () => {
    mockGetClient.mockResolvedValueOnce(mockAuthProcessResponseWithAdminId);
    const result = await clientService.getClientAdminId(
      unsafeBrandId(mockAuthProcessResponseWithAdminId.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toBeDefined();
    expect(result).toEqual(mockAuthProcessResponseWithAdminId.data.adminId);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthProcessResponseWithAdminId.data.id },
    });
  });

  it("Should throw clientAdminIdNotFound if the client has no adminId", async () => {
    mockGetClient.mockResolvedValueOnce(mockAuthProcessResponseWithoutAdminId);
    await expect(
      clientService.getClientAdminId(
        unsafeBrandId(mockAuthProcessResponseWithoutAdminId.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      clientAdminIdNotFound(mockAuthProcessResponseWithoutAdminId.data)
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClient,
      params: { clientId: mockAuthProcessResponseWithoutAdminId.data.id },
    });
  });
});
