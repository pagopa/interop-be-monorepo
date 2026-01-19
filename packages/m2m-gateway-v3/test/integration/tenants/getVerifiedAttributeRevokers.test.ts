import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { getMockedApiVerifiedTenantAttributeRevoker } from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenantVerifiedAttributeRevokers", () => {
  // Test data setup
  const tenantId = generateId();
  const attributeId = generateId();
  const revoker1Id = generateId();
  const revoker2Id = generateId();

  // Mock response from tenant-process API
  const mockTenantProcessResponse = {
    results: [
      getMockedApiVerifiedTenantAttributeRevoker(revoker1Id),
      {
        ...getMockedApiVerifiedTenantAttributeRevoker(revoker2Id),
        delegationId: undefined, // Test case with no delegation
      },
    ],
    totalCount: 2,
  };

  // Helper function to transform tenant API response to M2M Gateway API format
  const transformToM2MGatewayFormat = (
    tenantRevoker: tenantApi.TenantRevoker
  ): m2mGatewayApiV3.TenantVerifiedAttributeRevoker => ({
    id: tenantRevoker.id,
    verifiedAt: tenantRevoker.verificationDate,
    expiresAt: tenantRevoker.expirationDate,
    extendedAt: tenantRevoker.extensionDate,
    revokedAt: tenantRevoker.revocationDate,
    delegationId: tenantRevoker.delegationId,
  });

  // Expected response after transformation
  const expectedTransformedResults = mockTenantProcessResponse.results.map(
    transformToM2MGatewayFormat
  );

  // Mock function for the tenant-process API call
  const mockGetTenantVerifiedAttributeRevokers = vi
    .fn()
    .mockResolvedValue({ data: mockTenantProcessResponse });

  // Setup mock client before tests
  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenantVerifiedAttributeRevokers:
        mockGetTenantVerifiedAttributeRevokers,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockGetTenantVerifiedAttributeRevokers.mockClear();
  });

  it("Should call tenant-process API and return transformed results", async () => {
    const limit = 10;
    const offset = 0;

    const result = await tenantService.getTenantVerifiedAttributeRevokers(
      unsafeBrandId(tenantId),
      unsafeBrandId(attributeId),
      { limit, offset },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenantVerifiedAttributeRevokers,
      params: { tenantId, attributeId },
      queries: { limit, offset },
    });

    expect(result).toEqual({
      results: expectedTransformedResults,
      pagination: {
        limit,
        offset,
        totalCount: 2,
      },
    });
  });
});
