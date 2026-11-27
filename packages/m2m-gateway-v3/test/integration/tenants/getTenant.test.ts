import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  tenantUnitType,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenant", () => {
  const parentTenantId = generateId();
  const rootTenantId = generateId();
  const mockApiTenant = getMockWithMetadata({
    ...getMockedApiTenant(),
    subUnitType: tenantUnitType.UO,
    parentTenants: [
      {
        id: parentTenantId,
        name: "Tenant AOO",
        subUnitType: tenantUnitType.AOO,
      },
      { id: rootTenantId, name: "Tenant root" },
    ],
  });

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
    const m2mTenantResponse: m2mGatewayApiV3.Tenant = {
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
      parentTenants: [
        {
          id: parentTenantId,
          name: "Tenant AOO",
          subUnitType: tenantUnitType.AOO,
        },
        { id: rootTenantId, name: "Tenant root" },
      ],
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

  it("Should return the root as the only parent of an AOO", async () => {
    const mockAoo = {
      ...getMockedApiTenant(),
      subUnitType: tenantUnitType.AOO,
      parentTenants: [{ id: rootTenantId, name: "Tenant root" }],
    };
    mockGetTenant.mockResolvedValueOnce(getMockWithMetadata(mockAoo));

    const result = await tenantService.getTenant(
      unsafeBrandId(mockAoo.id),
      getMockM2MAdminAppContext()
    );

    expect(result.subUnitType).toBe(tenantUnitType.AOO);
    expect(result.parentTenants).toStrictEqual([
      { id: rootTenantId, name: "Tenant root" },
    ]);
  });
});
