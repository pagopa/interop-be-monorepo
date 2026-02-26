import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TenantId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiFullProducerKeychain,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  producerKeychainService,
  mockPollingResponse,
  mockInteropBeClients,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
} from "../../integrationUtils.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata, userNotFound } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("addProducerKeychainUsers", () => {
  const tenantId = generateId<TenantId>();
  const linkUser: m2mGatewayApiV3.LinkUser = {
    userId: generateId(),
  };

  const mockTenant = getMockTenant(tenantId);
  const mockTenantWithMetadata = getMockWithMetadata(mockTenant);
  const mockTenantWithoutSelfcareId = getMockWithMetadata({
    ...mockTenant,
    selfcareId: undefined,
  });

  const mockSelfcareInstitutionUsers = [
    {
      id: linkUser.userId,
      name: "Mario",
      surname: "Rossi",
      roles: ["admin"],
    },
  ];

  const mockAuthorizationProcessResponse = getMockWithMetadata({
    ...getMockedApiFullProducerKeychain(),
    users: [linkUser.userId],
  });

  const mockAddProducerKeychainUsers = vi
    .fn()
    .mockResolvedValue(mockAuthorizationProcessResponse);

  const mockGetProducerKeychain = vi.fn(
    mockPollingResponse(mockAuthorizationProcessResponse, 2)
  );

  const mockGetTenant = vi.fn();
  const mockGetInstitutionUsersByProductUsingGET = vi.fn();

  mockInteropBeClients.authorizationClient = {
    producerKeychain: {
      getProducerKeychain: mockGetProducerKeychain,
      addProducerKeychainUsers: mockAddProducerKeychainUsers,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.selfcareClient = {
    institution: {
      getInstitutionUsersByProductUsingGET:
        mockGetInstitutionUsersByProductUsingGET,
    },
  } as unknown as PagoPAInteropBeClients["selfcareClient"];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(
      mockSelfcareInstitutionUsers
    );
    mockAddProducerKeychainUsers.mockResolvedValue(
      mockAuthorizationProcessResponse
    );
    mockGetProducerKeychain.mockImplementation(
      mockPollingResponse(mockAuthorizationProcessResponse, 2)
    );
  });

  const callService = async () =>
    producerKeychainService.addProducerKeychainUsers(
      unsafeBrandId(mockAuthorizationProcessResponse.data.id),
      linkUser.userId,
      getMockM2MAdminAppContext({ organizationId: tenantId })
    );

  it("Should succeed and perform API producerKeychains calls", async () => {
    const result = await callService();

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.authorizationClient.producerKeychain
          .addProducerKeychainUsers,
      params: {
        producerKeychainId: mockAuthorizationProcessResponse.data.id,
      },
      body: { userIds: [linkUser.userId] },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.authorizationClient.producerKeychain
          .getProducerKeychain,
      params: { producerKeychainId: mockAuthorizationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.authorizationClient.producerKeychain
        .getProducerKeychain
    ).toHaveBeenCalledTimes(2);
    expect(mockGetTenant).toHaveBeenCalledTimes(1);
    expect(mockGetInstitutionUsersByProductUsingGET).toHaveBeenCalledTimes(1);
  });

  it("Should throw userNotFound if the user does not exist in selfcare", async () => {
    mockGetInstitutionUsersByProductUsingGET.mockRejectedValueOnce(
      userNotFound(unsafeBrandId(linkUser.userId), tenantId)
    );

    await expect(callService()).rejects.toThrowError(
      userNotFound(unsafeBrandId(linkUser.userId), tenantId)
    );

    expect(mockAddProducerKeychainUsers).not.toHaveBeenCalled();
  });

  it("Should throw an error if the tenant does not have a selfcareId", async () => {
    mockGetTenant.mockResolvedValueOnce(mockTenantWithoutSelfcareId);

    await expect(callService()).rejects.toThrowError();

    expect(mockGetInstitutionUsersByProductUsingGET).not.toHaveBeenCalled();
    expect(mockAddProducerKeychainUsers).not.toHaveBeenCalled();
  });

  it("Should throw missingMetadata in case the producerKeychain returned by the addProducerKeychainUsers POST call has no metadata", async () => {
    mockAddProducerKeychainUsers.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(callService()).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the producerKeychain returned by the polling GET call has no metadata", async () => {
    mockGetProducerKeychain.mockResolvedValueOnce({
      ...mockAuthorizationProcessResponse,
      metadata: undefined,
    });

    await expect(callService()).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetProducerKeychain.mockImplementation(
      mockPollingResponse(
        mockAuthorizationProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(callService()).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetProducerKeychain).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
