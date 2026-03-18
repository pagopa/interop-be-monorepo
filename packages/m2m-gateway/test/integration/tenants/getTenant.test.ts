import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenant", () => {
  const mockApiTenant = getMockWithMetadata(getMockedApiTenant());

  const mockGetTenant = vi.fn().mockResolvedValue(mockApiTenant);

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantResponse: m2mGatewayApi.Tenant = {
      id: mockApiTenant.data.id,
      createdAt: mockApiTenant.data.createdAt,
      externalId: {
        origin: mockApiTenant.data.externalId.origin,
        value: mockApiTenant.data.externalId.value,
      },
      name: mockApiTenant.data.name,
      kind: mockApiTenant.data.kind,
      onboardedAt: mockApiTenant.data.onboardedAt,
      subUnitType: mockApiTenant.data.subUnitType,
      updatedAt: mockApiTenant.data.updatedAt,
    };

    const result = await tenantService.getTenant(
      unsafeBrandId(mockApiTenant.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mTenantResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: mockApiTenant.data.id,
      },
    });
  });
});
