import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { PUBLIC_ADMINISTRATIONS_IDENTIFIER } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiTenant,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { taxCodeAndIPACodeConflict } from "../../../src/model/errors.js";

describe("getTenants", () => {
  const mockParams: m2mGatewayApi.GetTenantsQueryParams = {
    taxCode: undefined,
    IPACode: undefined,
    offset: 0,
    limit: 10,
  };

  const mockApiTenant1 = getMockedApiTenant();
  const mockApiTenant2 = getMockedApiTenant();

  const mockApiTenants = [mockApiTenant1.data, mockApiTenant2.data];

  const mockTenantProcessResponse: WithMaybeMetadata<tenantApi.Tenants> = {
    data: {
      results: mockApiTenants,
      totalCount: mockApiTenants.length,
    },
    metadata: undefined,
  };

  const mockGetTenants = vi.fn().mockResolvedValue(mockTenantProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenants: mockGetTenants,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetTenants.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantResponse1: m2mGatewayApi.Tenant = {
      id: mockApiTenant1.data.id,
      createdAt: mockApiTenant1.data.createdAt,
      externalId: {
        origin: mockApiTenant1.data.externalId.origin,
        value: mockApiTenant1.data.externalId.value,
      },
      name: mockApiTenant1.data.name,
      kind: mockApiTenant1.data.kind,
      onboardedAt: mockApiTenant1.data.onboardedAt,
      subUnitType: mockApiTenant1.data.subUnitType,
      updatedAt: mockApiTenant1.data.updatedAt,
    };

    const m2mTenantResponse2: m2mGatewayApi.Tenant = {
      id: mockApiTenant2.data.id,
      createdAt: mockApiTenant2.data.createdAt,
      externalId: {
        origin: mockApiTenant2.data.externalId.origin,
        value: mockApiTenant2.data.externalId.value,
      },
      name: mockApiTenant2.data.name,
      kind: mockApiTenant2.data.kind,
      onboardedAt: mockApiTenant2.data.onboardedAt,
      subUnitType: mockApiTenant2.data.subUnitType,
      updatedAt: mockApiTenant2.data.updatedAt,
    };

    const m2mTenantsResponse: m2mGatewayApi.Tenants = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockTenantProcessResponse.data.totalCount,
      },
      results: [m2mTenantResponse1, m2mTenantResponse2],
    };

    const result = await tenantService.getTenants(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTenantsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenants,
      queries: {
        externalIdOrigin: undefined,
        externalIdValue: undefined,
        features: [],
        name: undefined,
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });

  it("Should call the process getTenants with externalIdOrigin filter as IPA identifier and externalIdValue as the passed IPACode value", async () => {
    await tenantService.getTenants(
      { ...mockParams, IPACode: "IPA123" },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenants,
      queries: {
        externalIdOrigin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        externalIdValue: "IPA123",
        features: [],
        name: undefined,
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });

  it("Should call the process getTenants with externalIdOrigin filter as undefined and externalIdValue as the passed TaxCode value", async () => {
    await tenantService.getTenants(
      { ...mockParams, taxCode: "TAX123" },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenants,
      queries: {
        externalIdOrigin: undefined,
        externalIdValue: "TAX123",
        features: [],
        name: undefined,
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });

  it("Should throw taxCodeAndIPACodeConflict if both IPACode and taxCode are provided", async () => {
    const params: m2mGatewayApi.GetTenantsQueryParams = {
      IPACode: "IPA123",
      taxCode: "TAX123",
      offset: 0,
      limit: 10,
    };

    await expect(
      tenantService.getTenants(params, getMockM2MAdminAppContext())
    ).rejects.toThrowError(taxCodeAndIPACodeConflict());
  });
});
