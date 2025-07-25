import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { mockInteropBeClients, tenantService } from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getVerifiedAttributeRevokers", () => {
  const tenantId = generateId();
  const attributeId = generateId();
  const revoker1Id = generateId();
  const revoker2Id = generateId();

  const mockTenantProcessResponse: {
    results: tenantApi.TenantRevoker[];
    totalCount: number;
  } = {
    results: [
      {
        id: revoker1Id,
        verificationDate: new Date("2024-01-01").toISOString(),
        expirationDate: new Date("2025-01-01").toISOString(),
        extensionDate: new Date("2025-06-01").toISOString(),
        revocationDate: new Date("2024-06-01").toISOString(),
        delegationId: generateId(),
      },
      {
        id: revoker2Id,
        verificationDate: new Date("2024-02-01").toISOString(),
        expirationDate: new Date("2025-02-01").toISOString(),
        extensionDate: undefined,
        revocationDate: new Date("2024-07-01").toISOString(),
        delegationId: undefined,
      },
    ],
    totalCount: 2,
  };

  const mockGetTenantVerifiedAttributeRevokers = vi
    .fn()
    .mockResolvedValue({ data: mockTenantProcessResponse });

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

    const result = await tenantService.getVerifiedAttributeRevokers(
      unsafeBrandId(tenantId),
      unsafeBrandId(attributeId),
      { limit, offset },
      getMockM2MAdminAppContext()
    );

    expect(mockGetTenantVerifiedAttributeRevokers).toHaveBeenCalledWith({
      params: { tenantId, attributeId },
      queries: { limit, offset },
      headers: expect.any(Object),
    });

    expect(result).toEqual({
      results: [
        {
          id: revoker1Id,
          verificationDate: "2024-01-01T00:00:00.000Z",
          expirationDate: "2025-01-01T00:00:00.000Z",
          extensionDate: "2025-06-01T00:00:00.000Z",
          revocationDate: "2024-06-01T00:00:00.000Z",
          delegationId: mockTenantProcessResponse.results[0].delegationId,
        },
        {
          id: revoker2Id,
          verificationDate: "2024-02-01T00:00:00.000Z",
          expirationDate: "2025-02-01T00:00:00.000Z",
          extensionDate: undefined,
          revocationDate: "2024-07-01T00:00:00.000Z",
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

    await tenantService.getVerifiedAttributeRevokers(
      unsafeBrandId(tenantId),
      unsafeBrandId(attributeId),
      { limit, offset },
      getMockM2MAdminAppContext()
    );

    expect(mockGetTenantVerifiedAttributeRevokers).toHaveBeenCalledWith({
      params: { tenantId, attributeId },
      queries: { limit, offset },
      headers: expect.any(Object),
    });
  });

  it("Should handle empty results", async () => {
    const emptyResponse = { results: [], totalCount: 0 };
    mockGetTenantVerifiedAttributeRevokers.mockResolvedValueOnce({
      data: emptyResponse,
    });

    const result = await tenantService.getVerifiedAttributeRevokers(
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
    mockGetTenantVerifiedAttributeRevokers.mockRejectedValueOnce(apiError);

    await expect(
      tenantService.getVerifiedAttributeRevokers(
        unsafeBrandId(tenantId),
        unsafeBrandId(attributeId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow("Tenant not found");
  });
});
