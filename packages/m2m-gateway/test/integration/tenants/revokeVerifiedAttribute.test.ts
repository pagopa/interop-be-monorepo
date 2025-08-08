import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiVerifiedTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  tenantService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeVerifiedAttribute", () => {
  const mockVerifiedAttribute = getMockedApiVerifiedTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          verified: mockVerifiedAttribute,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const mockRevokeVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      revokeVerifiedAttribute: mockRevokeVerifiedAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRevokeVerifiedAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("should revoke verified attribute", async () => {
    const result = await tenantService.revokeTenantVerifiedAttribute(
      unsafeBrandId("test-tenant-id"),
      unsafeBrandId(mockVerifiedAttribute.id),
      { agreementId: generateId() },
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockRevokeVerifiedAttribute,
      body: { agreementId: expect.any(String) },
      params: {
        tenantId: "test-tenant-id",
        attributeId: mockVerifiedAttribute.id,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenant,
      params: { id: expect.any(String) },
    });

    expect(result).toEqual({
      id: mockVerifiedAttribute.id,
      assignedAt: mockVerifiedAttribute.assignmentTimestamp,
    });
  });
});
