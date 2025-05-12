import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  attributeRegistryApi,
  m2mGatewayApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiAttribute,
  getMockedApiTenant,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import {
  unexpectedAttributeKind,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";

describe("getCertifiedAttributes", () => {
  const mockParams: m2mGatewayApi.GetCertifiedAttributesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const mockApiAttribute1 = getMockedApiAttribute();
  const mockApiAttribute2 = getMockedApiAttribute();

  const mockTenantAttribute1: tenantApi.CertifiedTenantAttribute = {
    id: mockApiAttribute1.data.id,
    assignmentTimestamp: new Date().toISOString(),
  };

  const mockTenantAttribute2: tenantApi.CertifiedTenantAttribute = {
    id: mockApiAttribute2.data.id,
    assignmentTimestamp: new Date().toISOString(),
  };

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
  const mockGetBulkedAttributesResponse: WithMaybeMetadata<attributeRegistryApi.Attributes> =
    {
      data: {
        results: [mockApiAttribute1.data, mockApiAttribute2.data],
        totalCount: 2,
      },
      metadata: undefined,
    };

  const mockGetTenant = vi.fn().mockResolvedValue(mockGetTenantResponse);
  const mockGetBulkedAttributes = vi
    .fn()
    .mockResolvedValue(mockGetBulkedAttributesResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetTenant.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const m2mCertifiedAttributeResponse1: m2mGatewayApi.TenantCertifiedAttribute =
      {
        id: mockApiAttribute1.data.id,
        description: mockApiAttribute1.data.description,
        name: mockApiAttribute1.data.name,
        code: mockApiAttribute1.data.code as string,
        origin: mockApiAttribute1.data.origin as string,
        assignedAt: mockTenantAttribute1.assignmentTimestamp,
      };

    const m2mCertifiedAttributeResponse2: m2mGatewayApi.TenantCertifiedAttribute =
      {
        id: mockApiAttribute2.data.id,
        description: mockApiAttribute2.data.description,
        name: mockApiAttribute2.data.name,
        code: mockApiAttribute2.data.code as string,
        origin: mockApiAttribute2.data.origin as string,
        assignedAt: mockTenantAttribute2.assignmentTimestamp,
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
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.attributeProcessClient.getBulkedAttributes,
      body: [mockTenantAttribute1.id, mockTenantAttribute2.id],
      queries: {
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });

  it.each([
    [
      attributeRegistryApi.AttributeKind.Values.VERIFIED,
      attributeRegistryApi.AttributeKind.Values.DECLARED,
    ],
  ])(
    "Should throw unexpectedAttributeKind in case the returned attribute has an unexpected kind",
    async (kind) => {
      const mockResponse = {
        ...mockGetBulkedAttributesResponse,
        data: {
          results: [
            { ...mockApiAttribute1.data, kind },
            mockApiAttribute2.data,
          ],
          totalCount: 2,
        },
      };

      mockInteropBeClients.attributeProcessClient.getBulkedAttributes =
        mockGetBulkedAttributes.mockResolvedValueOnce(mockResponse);

      await expect(
        tenantService.getCertifiedAttributes(
          unsafeBrandId(mockApiTenant.id),
          mockParams,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrowError(
        unexpectedAttributeKind(mockResponse.data.results[0])
      );
    }
  );

  it.each([
    { origin: undefined, code: "validCode" },
    { origin: "validOrigin", code: undefined },
    { origin: undefined, code: undefined },
  ])(
    "Should throw unexpectedUndefinedAttributeOriginOrCode in case the returned attribute has an unexpected kind",
    async (originAndCodeOverride) => {
      const mockResponse = {
        ...mockGetBulkedAttributesResponse,
        data: {
          results: [
            { ...mockApiAttribute1.data, ...originAndCodeOverride },
            mockApiAttribute2.data,
          ],
          totalCount: 2,
        },
      };

      mockInteropBeClients.attributeProcessClient.getBulkedAttributes =
        mockGetBulkedAttributes.mockResolvedValueOnce(mockResponse);

      await expect(
        tenantService.getCertifiedAttributes(
          unsafeBrandId(mockApiTenant.id),
          mockParams,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrowError(
        unexpectedUndefinedAttributeOriginOrCode(mockResponse.data.results[0])
      );
    }
  );
});
