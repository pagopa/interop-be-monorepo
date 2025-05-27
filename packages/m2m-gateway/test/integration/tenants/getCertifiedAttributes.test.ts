import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiCertifiedTenantAttribute,
  getMockedApiTenant,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getCertifiedAttributes", () => {
  const mockParams: m2mGatewayApi.GetCertifiedAttributesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const mockTenantAttribute1 = getMockedApiCertifiedTenantAttribute();

  const mockTenantAttribute2 = getMockedApiCertifiedTenantAttribute({
    revoked: true,
  });

  const mockApiTenant: tenantApi.Tenant = {
    ...getMockedApiTenant().data,
    attributes: [
      { certified: mockTenantAttribute1 },
      { certified: mockTenantAttribute2 },
    ],
  };

  const mockGetTenantResponse: WithMaybeMetadata<tenantApi.Tenant> = {
    data: mockApiTenant,
    metadata: undefined,
  };

  const mockGetTenant = vi.fn().mockResolvedValue(mockGetTenantResponse);

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
    const m2mCertifiedAttributeResponse1: m2mGatewayApi.TenantCertifiedAttribute =
      {
        id: mockTenantAttribute1.id,
        assignedAt: mockTenantAttribute1.assignmentTimestamp,
        revokedAt: undefined,
      };

    const m2mCertifiedAttributeResponse2: m2mGatewayApi.TenantCertifiedAttribute =
      {
        id: mockTenantAttribute2.id,
        assignedAt: mockTenantAttribute2.assignmentTimestamp,
        revokedAt: mockTenantAttribute2.revocationTimestamp,
      };

    const m2mTenantsResponse: m2mGatewayApi.TenantCertifiedAttributes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 2,
      },
      results: [m2mCertifiedAttributeResponse1, m2mCertifiedAttributeResponse2],
    };

    const result = await tenantService.getCertifiedAttributes(
      unsafeBrandId(mockApiTenant.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTenantsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: mockApiTenant.id,
      },
    });
  });
});
