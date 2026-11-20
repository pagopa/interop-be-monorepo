import { authorizationApi } from "pagopa-interop-api-clients";
import {
  getMockTenant,
  getMockWithMetadata,
  getMockedApiConsumerFullClient,
} from "pagopa-interop-commons-test";
import { TenantId, generateId } from "pagopa-interop-models";
import { describe, it, vi, beforeEach, expect } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { clientNotFound } from "../../../src/model/errors.js";
import {
  mockInteropBeClients,
  expectApiClientGetToHaveBeenCalledWith,
  clientService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getClientUsers", () => {
  const tenantId = generateId<TenantId>();
  const clientId = generateId();
  const userId1 = generateId();
  const userId2 = generateId();

  const mockTenant = getMockTenant(tenantId);
  const mockTenantWithMetadata = getMockWithMetadata(mockTenant);
  const mockTenantWithoutSelfcareId = getMockWithMetadata({
    ...mockTenant,
    selfcareId: undefined,
  });

  const mockSelfcareUser1 = {
    id: userId1,
    name: "Mario",
    surname: "Rossi",
    roles: [],
  };

  const mockSelfcareUser2 = {
    id: userId2,
    name: "Anna",
    surname: "Bianchi",
    roles: [],
  };

  const mockGetClientUsers = vi.fn();
  const mockGetClient = vi.fn();
  const mockGetTenant = vi.fn();
  const mockGetUserInfoUsingGET = vi.fn();

  mockInteropBeClients.authorizationClient = {
    client: {
      getClientUsers: mockGetClientUsers,
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.selfcareClient = {
    user: {
      getUserInfoUsingGET: mockGetUserInfoUsingGET,
    },
  } as unknown as PagoPAInteropBeClients["selfcareClient"];

  const callService = async () => {
    const context = getMockM2MAdminAppContext({ organizationId: tenantId });
    return await clientService.getClientUsers(clientId, context, {
      limit: 10,
      offset: 0,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClient.mockResolvedValue(
      getMockWithMetadata(getMockedApiConsumerFullClient())
    );
  });

  it("Should reject an API client before retrieving users", async () => {
    const apiClient = getMockedApiConsumerFullClient({
      kind: authorizationApi.ClientKind.Values.API,
    });
    mockGetClient.mockReset().mockResolvedValue(getMockWithMetadata(apiClient));

    await expect(
      clientService.getClientUsers(
        apiClient.id,
        getMockM2MAdminAppContext({ organizationId: tenantId }),
        { limit: 10, offset: 0 }
      )
    ).rejects.toThrowError(clientNotFound(apiClient));

    expect(mockGetClientUsers).not.toHaveBeenCalled();
    expect(mockGetTenant).not.toHaveBeenCalled();
  });

  it("Should succeed and return a list of users", async () => {
    mockGetClientUsers.mockResolvedValue(
      getMockWithMetadata([userId1, userId2])
    );

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);

    mockGetUserInfoUsingGET
      .mockResolvedValueOnce(mockSelfcareUser1)
      .mockResolvedValueOnce(mockSelfcareUser2);

    const result = await callService();
    const response = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 2,
      },
      results: [
        {
          familyName: "Rossi",
          name: "Mario",
          roles: [],
          userId: userId1,
        },
        {
          familyName: "Bianchi",
          name: "Anna",
          roles: [],
          userId: userId2,
        },
      ],
    };

    expect(result).toEqual(response);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClientUsers,
      params: { clientId },
    });

    expect(mockGetTenant).toBeCalledTimes(1);

    expect(mockGetUserInfoUsingGET).toBeCalledTimes(2);
  });

  it("Should return an empty array if the client has no users", async () => {
    mockGetClientUsers.mockResolvedValue(getMockWithMetadata([]));

    const result = await callService();
    const response = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 0,
      },
      results: [],
    };

    expect(result).toEqual(response);
    expect(mockGetClientUsers).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
    expect(mockGetUserInfoUsingGET).toBeCalledTimes(0);
  });

  it("Should throw an error if the tenant does not have a selfcareId", async () => {
    mockGetClientUsers.mockResolvedValue(getMockWithMetadata([userId1]));

    mockGetTenant.mockResolvedValue(mockTenantWithoutSelfcareId);

    await expect(callService()).rejects.toThrowError();

    expect(mockGetClientUsers).toBeCalledTimes(0);
    expect(mockGetTenant).toBeCalledTimes(1);
    expect(mockGetUserInfoUsingGET).toBeCalledTimes(0);
  });
});
