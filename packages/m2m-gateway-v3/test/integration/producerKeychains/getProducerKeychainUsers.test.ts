import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { TenantId, generateId } from "pagopa-interop-models";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  producerKeychainService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("getProducerKeychainUsers", () => {
  const tenantId = generateId<TenantId>();
  const producerKeychainId = generateId();
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

  const mockGetProducerKeychainUsers = vi.fn();
  const mockGetTenant = vi.fn();
  const mockGetUserInfoUsingGET = vi.fn();

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychainUsers: mockGetProducerKeychainUsers,
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
    return await producerKeychainService.getProducerKeychainUsers(
      producerKeychainId,
      context,
      {
        limit: 10,
        offset: 0,
      }
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.only("Should succeed and return a list of users", async () => {
    mockGetProducerKeychainUsers.mockResolvedValue(
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
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychainUsers,
      params: { producerKeychainId },
    });

    expect(mockGetTenant).toBeCalledTimes(1);

    expect(mockGetUserInfoUsingGET).toBeCalledTimes(2);
  });

  it("Should return an empty array if the producerKeychain has no users", async () => {
    mockGetProducerKeychainUsers.mockResolvedValue(getMockWithMetadata([]));

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
    expect(mockGetProducerKeychainUsers).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
    expect(mockGetUserInfoUsingGET).toBeCalledTimes(0);
  });

  it("Should throw an error if the tenant does not have a selfcareId", async () => {
    mockGetProducerKeychainUsers.mockResolvedValue(
      getMockWithMetadata([userId1])
    );

    mockGetTenant.mockResolvedValue(mockTenantWithoutSelfcareId);

    await expect(callService()).rejects.toThrowError();

    expect(mockGetProducerKeychainUsers).toBeCalledTimes(0);
    expect(mockGetTenant).toBeCalledTimes(1);
    expect(mockGetUserInfoUsingGET).toBeCalledTimes(0);
  });
});
