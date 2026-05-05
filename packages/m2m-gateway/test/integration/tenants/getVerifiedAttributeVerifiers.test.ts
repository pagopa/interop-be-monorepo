import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { getMockedApiVerifiedTenantAttributeVerifier } from "pagopa-interop-commons-test/index.js";
import { mockInteropBeClients, tenantService } from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenantVerifiedAttributeVerifiers", () => {
  // Test data setup
  const tenantId = generateId();
  const attributeId = generateId();
  const verifier1Id = generateId();
  const verifier2Id = generateId();

  // Mock response from tenant-process API
  const mockTenantProcessResponse = {
    results: [
      getMockedApiVerifiedTenantAttributeVerifier(verifier1Id),
      {
        ...getMockedApiVerifiedTenantAttributeVerifier(verifier2Id),
        delegationId: undefined, // Test case with no delegation
      },
    ],
    totalCount: 2,
  };

  // Helper function to transform tenant API response to M2M Gateway API format
  const transformToM2MGatewayFormat = (
    tenantVerifier: tenantApi.TenantVerifier
  ): m2mGatewayApi.TenantVerifiedAttributeVerifier => ({
    id: tenantVerifier.id,
    verifiedAt: tenantVerifier.verificationDate,
    expiresAt: tenantVerifier.expirationDate,
    extendedAt: tenantVerifier.extensionDate,
    delegationId: tenantVerifier.delegationId,
  });

  // Expected response after transformation
  const expectedTransformedResults = mockTenantProcessResponse.results.map(
    transformToM2MGatewayFormat
  );

  // Mock function for the tenant-process API call
  const mockGetTenantVerifiedAttributeVerifiers = vi
    .fn()
    .mockResolvedValue({ data: mockTenantProcessResponse });

  // Setup mock client before tests
  mockInteropBeClients.tenantProcessClient = {
    tenant: {
      getTenantVerifiedAttributeVerifiers:
        mockGetTenantVerifiedAttributeVerifiers,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockGetTenantVerifiedAttributeVerifiers.mockClear();
  });

  it("Should call tenant-process API and return transformed results", async () => {
    const limit = 10;
    const offset = 0;

    const result = await tenantService.getTenantVerifiedAttributeVerifiers(
      unsafeBrandId(tenantId),
      unsafeBrandId(attributeId),
      { limit, offset },
      getMockM2MAdminAppContext()
    );

    expect(mockGetTenantVerifiedAttributeVerifiers).toHaveBeenCalledWith({
      params: { tenantId, attributeId },
      queries: { limit, offset },
      headers: expect.any(Object),
    });

    expect(result).toStrictEqual({
      results: expectedTransformedResults,
      pagination: {
        limit,
        offset,
        totalCount: 2,
      },
    });
  });
});
