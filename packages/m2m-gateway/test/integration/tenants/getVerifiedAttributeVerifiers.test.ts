import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { getMockedApiVerifiedTenantAttributeVerifier } from "pagopa-interop-commons-test/index.js";
import { mockInteropBeClients, tenantService } from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenantVerifiedAttributeVerifiers", () => {
  const tenantId = generateId();
  const attributeId = generateId();
  const verifier1Id = generateId();
  const verifier2Id = generateId();

  const mockTenantProcessResponse: {
    results: m2mGatewayApi.TenantVerifiedAttributeVerifier[];
    totalCount: number;
  } = {
    results: [
      getMockedApiVerifiedTenantAttributeVerifier(verifier1Id, generateId()),
      getMockedApiVerifiedTenantAttributeVerifier(verifier2Id),
    ],
    totalCount: 2,
  };

  const mockGetTenantVerifiedAttributeVerifiers = vi
    .fn()
    .mockResolvedValue({ data: mockTenantProcessResponse });

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

    expect(result).toEqual({
      results: [
        {
          id: verifier1Id,
          verificationDate: "2024-01-01T00:00:00.000Z",
          expirationDate: "2025-01-01T00:00:00.000Z",
          extensionDate: "2025-06-01T00:00:00.000Z",
          delegationId: mockTenantProcessResponse.results[0].delegationId,
        },
        {
          id: verifier2Id,
          verificationDate: "2024-02-01T00:00:00.000Z",
          expirationDate: "2025-02-01T00:00:00.000Z",
          extensionDate: undefined,
          delegationId: undefined,
        },
      ],
      pagination: {
        limit,
        offset,
        totalCount: 2,
      },
    });
  });
});
