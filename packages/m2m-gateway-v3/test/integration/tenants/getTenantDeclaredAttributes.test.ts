import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockedApiDeclaredTenantAttribute,
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

describe("getTenantDeclaredAttributes", () => {
  const tenantId = generateId();

  const mockDeclaredAttribute1 = getMockedApiDeclaredTenantAttribute({
    revoked: true,
  });
  const mockDeclaredAttribute2 = getMockedApiDeclaredTenantAttribute();

  const testToM2MGatewayApiDeclaredAttribute = (
    attribute: tenantApi.DeclaredTenantAttribute
  ): m2mGatewayApiV3.TenantDeclaredAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
    delegationId: attribute.delegationId,
  });

  // Pagination (and the delegationId filter) is now performed by tenant-process:
  // the gateway only forwards the query params and maps the paginated results.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockDeclaredAttribute1, mockDeclaredAttribute2],
    totalCount: 5,
  });

  const mockGetTenantDeclaredAttributes = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenantDeclaredAttributes: mockGetTenantDeclaredAttributes,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockGetTenantDeclaredAttributes.mockClear();
  });

  it("Should delegate pagination to tenant-process and map the results", async () => {
    const expected: m2mGatewayApiV3.TenantDeclaredAttributes = {
      results: [
        testToM2MGatewayApiDeclaredAttribute(mockDeclaredAttribute1),
        testToM2MGatewayApiDeclaredAttribute(mockDeclaredAttribute2),
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 5,
      },
    };

    const result = await tenantService.getTenantDeclaredAttributes(
      unsafeBrandId(tenantId),
      { offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.tenantProcessClient.tenant
          .getTenantDeclaredAttributes,
      params: { tenantId },
      queries: { delegationId: undefined, offset: 0, limit: 10 },
    });
  });

  it("Should forward the delegationId filter and pagination params", async () => {
    const delegationId = generateId();

    await tenantService.getTenantDeclaredAttributes(
      unsafeBrandId(tenantId),
      { delegationId, offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.tenantProcessClient.tenant
          .getTenantDeclaredAttributes,
      params: { tenantId },
      queries: { delegationId, offset: 2, limit: 2 },
    });
  });
});
