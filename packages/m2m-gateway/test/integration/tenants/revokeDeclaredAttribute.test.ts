import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiDeclaredTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeDeclaredAttribute", () => {
  const mockDeclaredAttribute = getMockedApiDeclaredTenantAttribute({
    revoked: true,
  });
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          declared: mockDeclaredAttribute,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const mockRevokeDeclaredAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      revokeDeclaredAttribute: mockRevokeDeclaredAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRevokeDeclaredAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("should revoke declared attribute", async () => {
    const result = await tenantService.revokeTenantDeclaredAttribute(
      unsafeBrandId("test-tenant-id"),
      unsafeBrandId(mockDeclaredAttribute.id),
      {},
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockRevokeDeclaredAttribute,
      params: {
        attributeId: mockDeclaredAttribute.id,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenant,
      params: { id: expect.any(String) },
    });

    expect(result).toEqual({
      id: mockDeclaredAttribute.id,
      assignedAt: mockDeclaredAttribute.assignmentTimestamp,
      revokedAt: mockDeclaredAttribute.revocationTimestamp,
      delegationId: mockDeclaredAttribute.delegationId,
    });
  });
});
