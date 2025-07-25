import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
  TenantId,
  AttributeId,
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
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeDeclaredAttribute", () => {
  const mockDeclaredAttribute1 = getMockedApiDeclaredTenantAttribute({
    revoked: true,
  });
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

  const testToM2MGatewayApiDeclaredAttribute = (
    attribute: tenantApi.DeclaredTenantAttribute
  ): m2mGatewayApi.TenantDeclaredAttribute => ({
    id: attribute.id,
    delegationId: attribute.delegationId,
    assignedAt: attribute.assignmentTimestamp,
    revokedAt: attribute.revocationTimestamp,
  });

  const m2mDeclaredAttributeResponse = testToM2MGatewayApiDeclaredAttribute(
    mockDeclaredAttribute1
  );

  const mockRevokeDeclaredAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);
  const mockGetTenant = vi.fn().mockResolvedValue(mockTenantProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      revokeDeclaredAttribute: mockRevokeDeclaredAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockRevokeDeclaredAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should revoke the declared attribute if found in the tenant", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const attributeId: AttributeId = unsafeBrandId(mockDeclaredAttribute1.id);

    const result = await tenantService.revokeDeclaredAttribute(
      tenantId,
      attributeId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mDeclaredAttributeResponse);

    expect(mockRevokeDeclaredAttribute).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
          "X-Correlation-Id": expect.any(String),
        }),
        params: expect.objectContaining({
          attributeId: mockDeclaredAttribute1.id,
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
          id: mockTenantProcessResponse.data.id,
        }),
      })
    );

    expect(mockGetTenant).toHaveBeenCalledTimes(1);
  });

  it("Should throw error if declared attribute not found after revocation", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const unknownAttributeId: AttributeId = generateId();

    await expect(
      tenantService.revokeDeclaredAttribute(
        tenantId,
        unknownAttributeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      `Declared attribute ${unknownAttributeId} not found after revocation`
    );
  });

  it("Should throw error when polling exceeds max retries", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const attributeId: AttributeId = unsafeBrandId(mockDeclaredAttribute1.id);

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

    mockRevokeDeclaredAttribute.mockResolvedValue(mockFailedPollingResponse);
    mockGetTenant.mockResolvedValue(mockFailedPollingResponse);

    await expect(
      tenantService.revokeDeclaredAttribute(
        tenantId,
        attributeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
  });

  it("Should throw error when response metadata is missing", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const attributeId: AttributeId = unsafeBrandId(mockDeclaredAttribute1.id);

    mockGetTenant.mockResolvedValue({
      data: mockTenantProcessResponse.data,
    });

    await expect(
      tenantService.revokeDeclaredAttribute(
        tenantId,
        attributeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });
});
