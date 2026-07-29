import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockedApiVerifiedTenantAttribute,
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

describe("getTenantVerifiedAttributes", () => {
  const tenantId = generateId();

  const mockVerifiedAttribute1 = getMockedApiVerifiedTenantAttribute();
  const mockVerifiedAttribute2 = getMockedApiVerifiedTenantAttribute();

  const testToM2MGatewayApiVerifiedAttribute = (
    attribute: tenantApi.VerifiedTenantAttribute
  ): m2mGatewayApiV3.TenantVerifiedAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
  });

  // Pagination is now performed by tenant-process.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockVerifiedAttribute1, mockVerifiedAttribute2],
    totalCount: 5,
  });

  const mockGetTenantVerifiedAttributes = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenantVerifiedAttributes: mockGetTenantVerifiedAttributes,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockGetTenantVerifiedAttributes.mockClear();
  });

  it("Should delegate pagination to tenant-process and map the results", async () => {
    const expected: m2mGatewayApiV3.TenantVerifiedAttributes = {
      results: [
        testToM2MGatewayApiVerifiedAttribute(mockVerifiedAttribute1),
        testToM2MGatewayApiVerifiedAttribute(mockVerifiedAttribute2),
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 5,
      },
    };

    const result = await tenantService.getTenantVerifiedAttributes(
      unsafeBrandId(tenantId),
      { offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.tenantProcessClient.tenant
          .getTenantVerifiedAttributes,
      params: { tenantId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should forward the pagination params to the process", async () => {
    await tenantService.getTenantVerifiedAttributes(
      unsafeBrandId(tenantId),
      { offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.tenantProcessClient.tenant
          .getTenantVerifiedAttributes,
      params: { tenantId },
      queries: { offset: 2, limit: 2 },
    });
  });
});
