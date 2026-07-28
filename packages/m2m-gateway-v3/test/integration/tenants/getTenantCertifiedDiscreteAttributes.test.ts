import { generateMock } from "@anatine/zod-mock";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockedApiCertifiedDiscreteTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenantCertifiedDiscreteAttributes", () => {
  const mockCertifiedDiscreteAttribute1 =
    getMockedApiCertifiedDiscreteTenantAttribute({
      revoked: true,
    });
  const mockCertifiedDiscreteAttribute2 =
    getMockedApiCertifiedDiscreteTenantAttribute();
  const mockCertifiedDiscreteAttribute3 =
    getMockedApiCertifiedDiscreteTenantAttribute();
  const mockCertifiedDiscreteAttribute4 =
    getMockedApiCertifiedDiscreteTenantAttribute();
  const mockCertifiedDiscreteAttribute5 =
    getMockedApiCertifiedDiscreteTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  ).filter((attr) => attr.certifiedDiscrete === undefined);

  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute1,
        },
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute2,
        },
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute3,
        },
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute4,
        },
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute5,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const testToM2MGatewayApiCertifiedDiscreteAttribute = (
    attribute: tenantApi.CertifiedDiscreteTenantAttribute
  ): m2mGatewayApiV3.TenantCertifiedDiscreteAttribute => ({
    id: attribute.id,
    discreteValue: attribute.discreteValue,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
  });

  const m2mCertifiedDiscreteAttributeResponse1 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(
      mockCertifiedDiscreteAttribute1
    );

  const m2mCertifiedDiscreteAttributeResponse2 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(
      mockCertifiedDiscreteAttribute2
    );

  const m2mCertifiedDiscreteAttributeResponse3 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(
      mockCertifiedDiscreteAttribute3
    );

  const m2mCertifiedDiscreteAttributeResponse4 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(
      mockCertifiedDiscreteAttribute4
    );
  const m2mCertifiedDiscreteAttributeResponse5 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(
      mockCertifiedDiscreteAttribute5
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
    const m2mTenantsResponse: m2mGatewayApiV3.TenantCertifiedDiscreteAttributes =
      {
        pagination: {
          limit: 10,
          offset: 0,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [
          m2mCertifiedDiscreteAttributeResponse1,
          m2mCertifiedDiscreteAttributeResponse2,
          m2mCertifiedDiscreteAttributeResponse3,
          m2mCertifiedDiscreteAttributeResponse4,
          m2mCertifiedDiscreteAttributeResponse5,
        ],
      };

    const result = await tenantService.getTenantCertifiedDiscreteAttributes(
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
    const m2mCertifiedDiscreteAttributesResponse1: m2mGatewayApiV3.TenantCertifiedDiscreteAttributes =
      {
        pagination: {
          offset: 0,
          limit: 2,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [
          m2mCertifiedDiscreteAttributeResponse1,
          m2mCertifiedDiscreteAttributeResponse2,
        ],
      };

    const result1 = await tenantService.getTenantCertifiedDiscreteAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result1).toStrictEqual(m2mCertifiedDiscreteAttributesResponse1);

    const m2mCertifiedDiscreteAttributesResponse2: m2mGatewayApiV3.TenantCertifiedDiscreteAttributes =
      {
        pagination: {
          offset: 2,
          limit: 2,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [
          m2mCertifiedDiscreteAttributeResponse3,
          m2mCertifiedDiscreteAttributeResponse4,
        ],
      };
    const result2 = await tenantService.getTenantCertifiedDiscreteAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toStrictEqual(m2mCertifiedDiscreteAttributesResponse2);

    const m2mCertifiedDiscreteAttributesResponse3: m2mGatewayApiV3.TenantCertifiedDiscreteAttributes =
      {
        pagination: {
          offset: 4,
          limit: 2,
          totalCount: mockTenantProcessResponse.data.attributes.length,
        },
        results: [m2mCertifiedDiscreteAttributeResponse5],
      };
    const result3 = await tenantService.getTenantCertifiedDiscreteAttributes(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      {
        offset: 4,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toStrictEqual(m2mCertifiedDiscreteAttributesResponse3);
  });
});
