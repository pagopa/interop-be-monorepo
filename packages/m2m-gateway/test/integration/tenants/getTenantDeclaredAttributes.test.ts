import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiDeclaredTenantAttribute,
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

describe("getDeclaredAttributes", () => {
  const mockDeclaredAttribute1 = getMockedApiDeclaredTenantAttribute({
    revoked: true,
  });
  const mockDeclaredAttribute2 = getMockedApiDeclaredTenantAttribute();
  const mockDeclaredAttribute3 = getMockedApiDeclaredTenantAttribute();
  const mockDeclaredAttribute4 = getMockedApiDeclaredTenantAttribute();
  const mockDeclaredAttribute5 = getMockedApiDeclaredTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  ).filter((attr) => attr.declared === undefined);

  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          declared: mockDeclaredAttribute1,
        },
        {
          declared: mockDeclaredAttribute2,
        },
        {
          declared: mockDeclaredAttribute3,
        },
        {
          declared: mockDeclaredAttribute4,
        },
        {
          declared: mockDeclaredAttribute5,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const testToM2MGatewayApiDeclaredAttribute = (
    attribute: tenantApi.DeclaredTenantAttribute
  ): m2mGatewayApi.TenantDeclaredAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
    delegationId: attribute.delegationId,
  });

  const m2mDeclaredAttributeResponse1 = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute1
  );

  const m2mDeclaredAttributeResponse2 = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute2
  );

  const m2mDeclaredAttributeResponse3 = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute3
  );

  const m2mDeclaredAttributeResponse4 = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute4
  );
  const m2mDeclaredAttributeResponse5 = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute5
  );

  const mockGetTenant = vi.fn().mockResolvedValue(mockTenantProcessResponse);

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
    const m2mTenantsResponse: m2mGatewayApi.TenantDeclaredAttributes = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [
        m2mDeclaredAttributeResponse1,
        m2mDeclaredAttributeResponse2,
        m2mDeclaredAttributeResponse3,
        m2mDeclaredAttributeResponse4,
        m2mDeclaredAttributeResponse5,
      ],
    };

    const result = await tenantService.getTenantDeclaredAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mTenantsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: {
        id: mockTenantProcessResponse.data.id,
      },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const m2mDeclaredAttributesResponse1: m2mGatewayApi.TenantDeclaredAttributes =
    {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [m2mDeclaredAttributeResponse1, m2mDeclaredAttributeResponse2],
    };

    const result1 = await tenantService.getTenantDeclaredAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result1).toStrictEqual(m2mDeclaredAttributesResponse1);

    const m2mDeclaredAttributesResponse2: m2mGatewayApi.TenantDeclaredAttributes =
    {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [m2mDeclaredAttributeResponse3, m2mDeclaredAttributeResponse4],
    };
    const result2 = await tenantService.getTenantDeclaredAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toStrictEqual(m2mDeclaredAttributesResponse2);

    const m2mDeclaredAttributesResponse3: m2mGatewayApi.TenantDeclaredAttributes =
    {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [m2mDeclaredAttributeResponse5],
    };
    const result3 = await tenantService.getTenantDeclaredAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 4,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toStrictEqual(m2mDeclaredAttributesResponse3);
  });
});
