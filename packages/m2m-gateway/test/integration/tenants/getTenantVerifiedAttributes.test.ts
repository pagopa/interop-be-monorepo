import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiVerifiedTenantAttribute,
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

describe("getVerifiedAttributes", () => {
  const mockVerifiedAttribute1 = getMockedApiVerifiedTenantAttribute();
  const mockVerifiedAttribute2 = getMockedApiVerifiedTenantAttribute();
  const mockVerifiedAttribute3 = getMockedApiVerifiedTenantAttribute();
  const mockVerifiedAttribute4 = getMockedApiVerifiedTenantAttribute();
  const mockVerifiedAttribute5 = getMockedApiVerifiedTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  ).filter((attr) => attr.verified === undefined);

  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          verified: mockVerifiedAttribute1,
        },
        {
          verified: mockVerifiedAttribute2,
        },
        {
          verified: mockVerifiedAttribute3,
        },
        {
          verified: mockVerifiedAttribute4,
        },
        {
          verified: mockVerifiedAttribute5,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const testToM2MGatewayApiVerifiedAttribute = (
    attribute: tenantApi.VerifiedTenantAttribute
  ): m2mGatewayApi.TenantVerifiedAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
  });

  const m2mVerifiedAttributeResponse1 = testToM2MGatewayApiVerifiedAttribute(
    mockVerifiedAttribute1
  );

  const m2mVerifiedAttributeResponse2 = testToM2MGatewayApiVerifiedAttribute(
    mockVerifiedAttribute2
  );

  const m2mVerifiedAttributeResponse3 = testToM2MGatewayApiVerifiedAttribute(
    mockVerifiedAttribute3
  );

  const m2mVerifiedAttributeResponse4 = testToM2MGatewayApiVerifiedAttribute(
    mockVerifiedAttribute4
  );
  const m2mVerifiedAttributeResponse5 = testToM2MGatewayApiVerifiedAttribute(
    mockVerifiedAttribute5
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
    const m2mTenantsResponse: m2mGatewayApi.TenantVerifiedAttributes = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: mockTenantProcessResponse.data.attributes.length,
      },
      results: [
        m2mVerifiedAttributeResponse1,
        m2mVerifiedAttributeResponse2,
        m2mVerifiedAttributeResponse3,
        m2mVerifiedAttributeResponse4,
        m2mVerifiedAttributeResponse5,
      ],
    };

    const result = await tenantService.getTenantVerifiedAttributes(
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
    const m2mVerifiedAttributesResponse1: m2mGatewayApi.TenantVerifiedAttributes =
      {
        pagination: {
          offset: 0,
          limit: 2,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [m2mVerifiedAttributeResponse1, m2mVerifiedAttributeResponse2],
      };

    const result1 = await tenantService.getTenantVerifiedAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result1).toStrictEqual(m2mVerifiedAttributesResponse1);

    const m2mVerifiedAttributesResponse2: m2mGatewayApi.TenantVerifiedAttributes =
      {
        pagination: {
          offset: 2,
          limit: 2,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [m2mVerifiedAttributeResponse3, m2mVerifiedAttributeResponse4],
      };
    const result2 = await tenantService.getTenantVerifiedAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toStrictEqual(m2mVerifiedAttributesResponse2);

    const m2mVerifiedAttributesResponse3: m2mGatewayApi.TenantVerifiedAttributes =
      {
        pagination: {
          offset: 4,
          limit: 2,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [m2mVerifiedAttributeResponse5],
      };
    const result3 = await tenantService.getTenantVerifiedAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 4,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toStrictEqual(m2mVerifiedAttributesResponse3);
  });
});
