import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
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
  const tenantId = generateId();
  const attributeId = generateId();
  const revoker1Id = generateId();
  const revoker2Id = generateId();

  const mockTenantM2MResponse: {
    results: m2mGatewayApi.TenantVerifiedAttributeRevoker[];
    totalCount: number;
  } = {
    results: [
      getMockedApiVerifiedTenantAttributeRevoker(revoker1Id),
      {
        ...getMockedApiVerifiedTenantAttributeRevoker(revoker2Id),
        delegationId: undefined,
      },
    ],
    totalCount: 2,
  };

  const mockGetTenantVerifiedAttributeRevokers = vi
    .fn()
    .mockResolvedValue({ data: mockTenantM2MResponse });

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
      results: mockTenantM2MResponse.results,
      pagination: {
        limit,
        offset,
        totalCount: 2,
      },
    });
  });
});
