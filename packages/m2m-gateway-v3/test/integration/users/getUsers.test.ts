import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { TenantId, WithMetadata, generateId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { GetUsersQueryParams } from "../../../src/services/userService.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  mockInteropBeClients,
  expectApiClientGetToHaveBeenCalledWith,
  userService,
} from "../../integrationUtils.js";

interface SelfcareUser {
  id: string;
  name: string;
  surname: string;
  roles?: string[] | undefined;
  email?: string | undefined;
  fiscalCode?: string | undefined;
  role?:
  | "ADMIN_EA"
  | "DELEGATE"
  | "MANAGER"
  | "OPERATOR"
  | "SUB_DELEGATE"
  | undefined;
}

describe("getUsers", () => {
  const tenantId = generateId<TenantId>();
  const mockTenant = getMockTenant(tenantId);
  const mockTenantWithMetadata = getMockWithMetadata(mockTenant);
  const mockTenantWithMetadataAndEmptySelfcareId = getMockWithMetadata({
    ...mockTenant,
    selfcareId: undefined,
  });

  const mockUsers: WithMetadata<SelfcareUser[]> = getMockWithMetadata([
    {
      id: generateId(),
      name: "Mario",
      surname: "Rossi",
      roles: ["ADMIN_EA", "MANAGER"],
      email: "mario.rossi@example.com",
      fiscalCode: "AAABBB123A",
      role: "ADMIN_EA",
    },
    {
      id: generateId(),
      name: "Luigi",
      surname: "Verdi",
      roles: ["OPERATOR"],
      email: "luigi.verdi@example.com",
      fiscalCode: "CCCDDD456B",
      role: "OPERATOR",
    },
    {
      id: generateId(),
      name: "Anna",
      surname: "Bianchi",
      roles: ["MANAGER"],
      email: "anna.bianchi@example.com",
      fiscalCode: "EEEFFF789C",
      role: "MANAGER",
    },
  ]);

  const mockNoUsers: WithMetadata<SelfcareUser[]> = getMockWithMetadata([]);

  const mockGetTenant = vi.fn();
  const mockGetInstitutionUsersByProductUsingGET = vi.fn();

  // Inject mocked clients into the shared BE clients container
  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.selfcareProcessClient = {
    institution: {
      getInstitutionUsersByProductUsingGET:
        mockGetInstitutionUsersByProductUsingGET,
    },
  } as unknown as PagoPAInteropBeClients["selfcareProcessClient"];

  const callService = async (queryParams: GetUsersQueryParams) => {
    const context = getMockM2MAdminAppContext({ organizationId: tenantId });
    return await userService.getUsers(queryParams, context);
  };

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetTenant.mockClear();
    mockGetInstitutionUsersByProductUsingGET.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const queryParams: GetUsersQueryParams = {
      roles: [],
      limit: 10,
      offset: 0,
    };

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockUsers);

    const result = await callService(queryParams);

    expect(result).toEqual({
      results: [
        {
          userId: mockUsers.data[0].id,
          name: "Mario",
          familyName: "Rossi",
          roles: ["ADMIN_EA", "MANAGER"],
        },
        {
          userId: mockUsers.data[1].id,
          name: "Luigi",
          familyName: "Verdi",
          roles: ["OPERATOR"],
        },
        {
          userId: mockUsers.data[2].id,
          name: "Anna",
          familyName: "Bianchi",
          roles: ["MANAGER"],
        },
      ],
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 3,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareProcessClient.institution
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        productRoles: undefined,
      },
    });

    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should apply pagination correctly", async () => {
    const queryParams: GetUsersQueryParams = {
      roles: [],
      limit: 2,
      offset: 1,
    };

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockUsers);

    const result = await callService(queryParams);

    // Expecting users at index 1 and 2 (Luigi and Anna)
    expect(result).toEqual({
      results: [
        {
          userId: mockUsers.data[1].id,
          name: "Luigi",
          familyName: "Verdi",
          roles: ["OPERATOR"],
        },
        {
          userId: mockUsers.data[2].id,
          name: "Anna",
          familyName: "Bianchi",
          roles: ["MANAGER"],
        },
      ],
      pagination: {
        limit: 2,
        offset: 1,
        totalCount: 3,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });

    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should filter by roles correctly", async () => {
    const queryParams: GetUsersQueryParams = {
      roles: ["ADMIN_EA", "MANAGER"],
      limit: 10,
      offset: 0,
    };

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockUsers);

    const result = await callService(queryParams);

    expect(result.results.length).toBe(3);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareProcessClient.institution
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        productRoles: "ADMIN_EA,MANAGER",
      },
    });

    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should return empty results when no users found", async () => {
    const queryParams: GetUsersQueryParams = {
      roles: [],
      limit: 10,
      offset: 0,
    };

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockNoUsers);

    const result = await callService(queryParams);

    expect(result).toEqual({
      results: [],
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 0,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.selfcareProcessClient.institution
          .getInstitutionUsersByProductUsingGET,
      params: {
        institutionId: mockTenantWithMetadata.data.selfcareId,
      },
      queries: {
        productRoles: undefined,
      },
    });

    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should throw error if tenant does not have selfcareId", async () => {
    const queryParams: GetUsersQueryParams = {
      roles: [],
      limit: 10,
      offset: 0,
    };

    mockGetTenant.mockResolvedValue(mockTenantWithMetadataAndEmptySelfcareId);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockUsers);

    await expect(callService(queryParams)).rejects.toThrowError();

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: tenantId,
      },
    });

    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(0);
    expect(mockGetTenant).toBeCalledTimes(1);
  });

  it("Should handle pagination with offset beyond available users", async () => {
    const queryParams: GetUsersQueryParams = {
      roles: [],
      limit: 10,
      offset: 100,
    };

    mockGetTenant.mockResolvedValue(mockTenantWithMetadata);
    mockGetInstitutionUsersByProductUsingGET.mockResolvedValue(mockUsers);

    const result = await callService(queryParams);

    // No users should be returned since offset is beyond the total count
    expect(result).toEqual({
      results: [],
      pagination: {
        limit: 10,
        offset: 100,
        totalCount: 3,
      },
    });

    expect(mockGetInstitutionUsersByProductUsingGET).toBeCalledTimes(1);
    expect(mockGetTenant).toBeCalledTimes(1);
  });
});
