import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiCertifiedTenantAttribute,
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

describe("getTenantCertifiedAttributes", () => {
  const mockCertifiedAttribute1 = getMockedApiCertifiedTenantAttribute({
    revoked: true,
  });
  const mockCertifiedAttribute2 = getMockedApiCertifiedTenantAttribute();
  const mockCertifiedAttribute3 = getMockedApiCertifiedTenantAttribute();
  const mockCertifiedAttribute4 = getMockedApiCertifiedTenantAttribute();
  const mockCertifiedAttribute5 = getMockedApiCertifiedTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  ).filter((attr) => attr.certified === undefined);

  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          certified: mockCertifiedAttribute1,
        },
        {
          certified: mockCertifiedAttribute2,
        },
        {
          certified: mockCertifiedAttribute3,
        },
        {
          certified: mockCertifiedAttribute4,
        },
        {
          certified: mockCertifiedAttribute5,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const testToM2MGatewayApiCertifiedAttribute = (
    attribute: tenantApi.CertifiedTenantAttribute
  ): m2mGatewayApi.TenantCertifiedAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
  });

  const m2mCertifiedAttributeResponse1 = testToM2MGatewayApiCertifiedAttribute(
    mockCertifiedAttribute1
  );

  const m2mCertifiedAttributeResponse2 = testToM2MGatewayApiCertifiedAttribute(
    mockCertifiedAttribute2
  );

  const m2mCertifiedAttributeResponse3 = testToM2MGatewayApiCertifiedAttribute(
    mockCertifiedAttribute3
  );

  const m2mCertifiedAttributeResponse4 = testToM2MGatewayApiCertifiedAttribute(
    mockCertifiedAttribute4
  );
  const m2mCertifiedAttributeResponse5 = testToM2MGatewayApiCertifiedAttribute(
    mockCertifiedAttribute5
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
    const m2mTenantsResponse: m2mGatewayApi.TenantCertifiedAttributes = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [
        m2mCertifiedAttributeResponse1,
        m2mCertifiedAttributeResponse2,
        m2mCertifiedAttributeResponse3,
        m2mCertifiedAttributeResponse4,
        m2mCertifiedAttributeResponse5,
      ],
    };

    const result = await tenantService.getTenantCertifiedAttributes(
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
    const m2mCertifiedAttributesResponse1: m2mGatewayApi.TenantCertifiedAttributes =
    {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [
        m2mCertifiedAttributeResponse1,
        m2mCertifiedAttributeResponse2,
      ],
    };

    const result1 = await tenantService.getTenantCertifiedAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result1).toStrictEqual(m2mCertifiedAttributesResponse1);

    const m2mCertifiedAttributesResponse2: m2mGatewayApi.TenantCertifiedAttributes =
    {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [
        m2mCertifiedAttributeResponse3,
        m2mCertifiedAttributeResponse4,
      ],
    };
    const result2 = await tenantService.getTenantCertifiedAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toStrictEqual(m2mCertifiedAttributesResponse2);

    const m2mCertifiedAttributesResponse3: m2mGatewayApi.TenantCertifiedAttributes =
    {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [m2mCertifiedAttributeResponse5],
    };
    const result3 = await tenantService.getTenantCertifiedAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 4,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toStrictEqual(m2mCertifiedAttributesResponse3);
  });
});
