import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { TenantId, UserId, generateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { userServiceBuilder } from "../../../src/services/userService.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  mockInteropBeClients,
  expectApiClientGetToHaveBeenCalledWith,
} from "../../integrationUtils.js";

describe("getUserById", () => {
  const tenantId = generateId<TenantId>();
  const userId = generateId<UserId>();
  const differentUserId = generateId<UserId>();
  const mockTenant = getMockTenant(tenantId);
  const mockTenantWithMetadata = getMockWithMetadata(mockTenant);
  const mockTenantWithMetadataAndEmptySelfcareId = getMockWithMetadata({
    ...mockTenant,
    selfcareId: undefined,
  });
  const mockCorrectUser: selfcareV2ClientApi.UserResource[] = [
    {
      id: userId,
      name: "Mario",
      surname: "Rossi",
      roles: ["ADMIN_EA", "MANAGER"],
      email: "mario.rossi@example.com",
      fiscalCode: "AAABBB123A",
      role: "ADMIN_EA",
    },
  ];

  const mockTooManyUsers: selfcareV2ClientApi.UserResource[] = [
    {
      id: userId,
      name: "Mario",
      surname: "Rossi",
      roles: ["ADMIN_EA", "MANAGER"],
      email: "mario.rossi@example.com",
      fiscalCode: "AAABBB123A",
      role: "ADMIN_EA",
    },
    {
      id: differentUserId,
      name: "Mario",
      surname: "Rossi",
      roles: ["ADMIN_EA", "MANAGER"],
      email: "mario.rossi@example.com",
      fiscalCode: "AAABBB123A",
      role: "ADMIN_EA",
    },
  ];

  const mockDifferentUser: selfcareV2ClientApi.UserResource[] = [
    {
      id: differentUserId,
      name: "Mario",
      surname: "Rossi",
      roles: ["ADMIN_EA", "MANAGER"],
      email: "mario.rossi@example.com",
      fiscalCode: "AAABBB123A",
      role: "ADMIN_EA",
    },
  ];

  const mockNoUsers: selfcareV2ClientApi.UserResource[] = [];

  const mockGetTenant = vi.fn();
  const mockGetInstitutionUsersByProductUsingGET = vi.fn();

  // Inject mocked clients into the shared BE clients container
  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.selfcareV2Client = {
    getInstitutionUsersByProductUsingGET:
      mockGetInstitutionUsersByProductUsingGET,
  } as unknown as PagoPAInteropBeClients["selfcareV2Client"];

  const userService = userServiceBuilder(mockInteropBeClients);

  const callService = async () => {
    const context = getMockM2MAdminAppContext({ organizationId: tenantId });
    return await userService.getUserById(userId, context);
  };
  const userNotFoundRegex =
    /^User [0-9a-f-]+ not found for tenant [0-9a-f-]+$/gi;

  const selfcareNotFoundRegex = /^SelfcareId in Tenant [0-9a-f-]+ not found$/gi;

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetTenant.mockClear();
    mockGetInstitutionUsersByProductUsingGET.mockClear();
  });

  it("Should succeed and perform API calls", async () => {
    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockCorrectUser);
    const result = await callService();
    expect(result).toEqual({
      userId: mockCorrectUser[0].id,
      name: mockCorrectUser[0].name,
      familyName: mockCorrectUser[0].surname,
      roles: mockCorrectUser[0].roles,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareV2Client
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        userId,
      },
    });
    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should throw error if user is not found", async () => {
    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockNoUsers);
    await expect(callService()).rejects.toMatchObject({
      message: expect.stringMatching(userNotFoundRegex),
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareV2Client
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        userId,
      },
    });
    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should throw error if more than one user is found", async () => {
    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(
      mockTooManyUsers
    );
    await expect(callService()).rejects.toMatchObject({
      message: expect.stringMatching(userNotFoundRegex),
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareV2Client
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        userId,
      },
    });
    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should throw error if the wrong user is found", async () => {
    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(
      mockDifferentUser
    );
    await expect(callService()).rejects.toMatchObject({
      message: expect.stringMatching(userNotFoundRegex),
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareV2Client
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        userId,
      },
    });
    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should throw error if selfcare id is not found in the tenant", async () => {
    mockGetTenant.mockResolvedValue(mockTenantWithMetadataAndEmptySelfcareId);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockCorrectUser);
    await expect(callService()).rejects.toMatchObject({
      message: expect.stringMatching(selfcareNotFoundRegex),
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });
    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(0);
    expect(mockGetTenant).toBeCalledTimes(1);
  });
});
