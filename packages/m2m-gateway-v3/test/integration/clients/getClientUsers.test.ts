import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { TenantId, generateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  mockInteropBeClients,
  expectApiClientGetToHaveBeenCalledWith,
  clientService,
} from "../../integrationUtils.js";

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
  };

  const mockSelfcareUser2 = {
    id: userId2,
    name: "Anna",
    surname: "Bianchi",
  };

  const mockGetClientUsers = vi.fn();
  const mockGetTenant = vi.fn();
  const mockGetUserInfoUsingGET = vi.fn();

  mockInteropBeClients.authorizationClient = {
    client: {
      getClientUsers: mockGetClientUsers,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.selfcareProcessClient = {
    user: {
      getUserInfoUsingGET: mockGetUserInfoUsingGET,
    },
  } as unknown as PagoPAInteropBeClients["selfcareProcessClient"];

  const callService = async () => {
    const context = getMockM2MAdminAppContext({ organizationId: tenantId });
    return await clientService.getClientUsers(clientId, context);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Should succeed and return a list of compact users", async () => {
    mockGetClientUsers.mockResolvedValue(
      getMockWithMetadata([userId1, userId2])
    );

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);

    mockGetUserInfoUsingGET
      .mockResolvedValueOnce(getMockWithMetadata(mockSelfcareUser1))
      .mockResolvedValueOnce(getMockWithMetadata(mockSelfcareUser2));

    const result = await callService();

    expect(result).toEqual([
      { userId: userId1, name: "Mario", familyName: "Rossi" },
      { userId: userId2, name: "Anna", familyName: "Bianchi" },
    ]);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.authorizationClient.client.getClientUsers,
      params: { clientId },
    });

    expect(mockGetTenant).toBeCalledTimes(2);

    expect(mockGetUserInfoUsingGET).toBeCalledTimes(2);
  });

  it("Should return an empty array if the client has no users", async () => {
    mockGetClientUsers.mockResolvedValue(getMockWithMetadata([]));

    const result = await callService();

    expect(result).toEqual([]);
    expect(mockGetClientUsers).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(0);
    expect(mockGetUserInfoUsingGET).toBeCalledTimes(0);
  });

  it("Should throw an error if the tenant does not have a selfcareId", async () => {
    mockGetClientUsers.mockResolvedValue(getMockWithMetadata([userId1]));

    mockGetTenant.mockResolvedValue(mockTenantWithoutSelfcareId);

    await expect(callService()).rejects.toThrowError();

    expect(mockGetClientUsers).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
    expect(mockGetUserInfoUsingGET).toBeCalledTimes(0);
  });
});
