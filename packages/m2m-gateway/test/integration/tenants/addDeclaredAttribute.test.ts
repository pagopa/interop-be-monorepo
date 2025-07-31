import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  TenantId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiDeclaredTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { mockInteropBeClients, tenantService } from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAppContext } from "../../mockUtils.js";

describe("addDeclaredAttribute", () => {
  const mockDeclaredAttribute1 = getMockedApiDeclaredTenantAttribute();
  const mockDeclaredAttribute2 = getMockedApiDeclaredTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          declared: mockDeclaredAttribute1,
        },
        {
          declared: mockDeclaredAttribute2,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const tenantId = generateId<TenantId>();

  const testToM2MGatewayApiDeclaredAttribute = (
    attribute: tenantApi.DeclaredTenantAttribute
  ): m2mGatewayApi.TenantDeclaredAttribute => ({
    id: attribute.id,
    delegationId: attribute.delegationId,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
  });

  const m2mDeclaredAttributeResponse1 = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute1
  );

  const mockAddDeclaredAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn().mockResolvedValue(mockTenantProcessResponse);

  beforeEach(() => {
    mockInteropBeClients.tenantProcessClient = {
      tenantAttribute: {
        addDeclaredAttribute: mockAddDeclaredAttribute,
      },
      tenant: {
        getTenant: mockGetTenant,
      },
      selfcare: vi.fn(),
    } as unknown as PagoPAInteropBeClients["tenantProcessClient"];
  });

  it("Should add the declared attribute if found in the tenant", async () => {
    const seed: m2mGatewayApi.TenantDeclaredAttributeSeed = {
      id: mockDeclaredAttribute1.id,
    };

    const result = await tenantService.addDeclaredAttribute(
      tenantId,
      seed,
      getMockM2MAppContext()
    );

    expect(result).toEqual(m2mDeclaredAttributeResponse1);

    expect(mockAddDeclaredAttribute).toHaveBeenCalledWith(
      { id: seed.id },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
          "X-Correlation-Id": expect.any(String),
        }),
      })
    );

    expect(mockGetTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
          "X-Correlation-Id": expect.any(String),
        }),
        params: expect.objectContaining({
          id: expect.any(String),
        }),
      })
    );
  });

  it("Should throw error if declared attribute not found after assignment", async () => {
    const unknownAttributeId = generateId();
    const seed: m2mGatewayApi.TenantDeclaredAttributeSeed = {
      id: unknownAttributeId,
    };

    await expect(
      tenantService.addDeclaredAttribute(tenantId, seed, getMockM2MAppContext())
    ).rejects.toThrow(
      `Declared attribute ${unknownAttributeId} not found after assignment`
    );
  });

  it("Should throw error when polling exceeds max retries", async () => {
    const seed: m2mGatewayApi.TenantDeclaredAttributeSeed = {
      id: mockDeclaredAttribute1.id,
    };

    // Mock polling to fail after max retries
    const mockFailedPollingResponse = {
      data: getMockedApiTenant(),
      metadata: {
        _links: {
          self: {
            href: "http://example.com/polling",
          },
        },
      },
      headers: { "retry-after": "1" },
    };

    mockGetTenant.mockResolvedValue(mockFailedPollingResponse);

    await expect(
      tenantService.addDeclaredAttribute(tenantId, seed, getMockM2MAppContext())
    ).rejects.toThrow(pollingMaxRetriesExceeded(3, 10));
  });

  it("Should throw error when response metadata is missing", async () => {
    const seed: m2mGatewayApi.TenantDeclaredAttributeSeed = {
      id: mockDeclaredAttribute1.id,
    };

    mockGetTenant.mockResolvedValue({
      data: mockTenantProcessResponse.data,
    });

    await expect(
      tenantService.addDeclaredAttribute(tenantId, seed, getMockM2MAppContext())
    ).rejects.toThrow(missingMetadata());
  });
});
