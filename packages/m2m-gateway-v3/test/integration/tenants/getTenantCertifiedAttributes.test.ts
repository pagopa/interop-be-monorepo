import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockedApiCertifiedTenantAttribute,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenantCertifiedAttributes", () => {
  const tenantId = generateId();

  const mockCertifiedAttribute1 = getMockedApiCertifiedTenantAttribute({
    revoked: true,
  });
  const mockCertifiedAttribute2 = getMockedApiCertifiedTenantAttribute();

  const testToM2MGatewayApiCertifiedAttribute = (
    attribute: tenantApi.CertifiedTenantAttribute
  ): m2mGatewayApiV3.TenantCertifiedAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
  });

  // Pagination is now performed by tenant-process.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockCertifiedAttribute1, mockCertifiedAttribute2],
    totalCount: 5,
  });

  const mockGetTenantCertifiedAttributes = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenantCertifiedAttributes: mockGetTenantCertifiedAttributes,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockGetTenantCertifiedAttributes.mockClear();
  });

  it("Should delegate pagination to tenant-process and map the results", async () => {
    const expected: m2mGatewayApiV3.TenantCertifiedAttributes = {
      results: [
        testToM2MGatewayApiCertifiedAttribute(mockCertifiedAttribute1),
        testToM2MGatewayApiCertifiedAttribute(mockCertifiedAttribute2),
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 5,
      },
    };

    const result = await tenantService.getTenantCertifiedAttributes(
      unsafeBrandId(tenantId),
      { offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.tenantProcessClient.tenant
          .getTenantCertifiedAttributes,
      params: { tenantId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should forward the pagination params to the process", async () => {
    await tenantService.getTenantCertifiedAttributes(
      unsafeBrandId(tenantId),
      { offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.tenantProcessClient.tenant
          .getTenantCertifiedAttributes,
      params: { tenantId },
      queries: { offset: 2, limit: 2 },
    });
  });
});
