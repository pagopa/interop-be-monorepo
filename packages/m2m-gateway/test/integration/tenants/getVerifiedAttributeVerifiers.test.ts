import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { mockInteropBeClients, tenantService } from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getVerifiedAttributeVerifiers", () => {
  const tenantId = generateId();
  const attributeId = generateId();
  const verifier1Id = generateId();
  const verifier2Id = generateId();

  const mockTenantProcessResponse: {
    results: tenantApi.TenantVerifier[];
    totalCount: number;
  } = {
    results: [
      {
        id: verifier1Id,
        verificationDate: new Date("2024-01-01").toISOString(),
        expirationDate: new Date("2025-01-01").toISOString(),
        extensionDate: new Date("2025-06-01").toISOString(),
        delegationId: generateId(),
      },
      {
        id: verifier2Id,
        verificationDate: new Date("2024-02-01").toISOString(),
        expirationDate: new Date("2025-02-01").toISOString(),
        extensionDate: undefined,
        delegationId: undefined,
      },
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

    const result = await tenantService.getVerifiedAttributeVerifiers(
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

  it("Should handle pagination parameters correctly", async () => {
    const limit = 5;
    const offset = 10;

    await tenantService.getVerifiedAttributeVerifiers(
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
  });

  it("Should handle empty results", async () => {
    const emptyResponse = { results: [], totalCount: 0 };
    mockGetTenantVerifiedAttributeVerifiers.mockResolvedValueOnce({
      data: emptyResponse,
    });

    const result = await tenantService.getVerifiedAttributeVerifiers(
      unsafeBrandId(tenantId),
      unsafeBrandId(attributeId),
      { limit: 10, offset: 0 },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual({
      results: [],
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 0,
      },
    });
  });

  it("Should forward API errors from tenant-process", async () => {
    const apiError = new Error("Tenant not found");
    mockGetTenantVerifiedAttributeVerifiers.mockRejectedValueOnce(apiError);

    await expect(
      tenantService.getVerifiedAttributeVerifiers(
        unsafeBrandId(tenantId),
        unsafeBrandId(attributeId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow("Tenant not found");
  });
});
