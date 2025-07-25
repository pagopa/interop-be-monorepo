import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
  TenantId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiVerifiedTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { mockInteropBeClients, tenantService } from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("addVerifiedAttribute", () => {
  const mockVerifiedAttribute1 = getMockedApiVerifiedTenantAttribute();
  const mockVerifiedAttribute2 = getMockedApiVerifiedTenantAttribute();

  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );

  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          verified: mockVerifiedAttribute1,
        },
        {
          verified: mockVerifiedAttribute2,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const testToM2MGatewayApiVerifiedAttribute = (
    attribute: tenantApi.VerifiedTenantAttribute
  ): m2mGatewayApi.TenantVerifiedAttribute => ({
    id: attribute.id,
    assignedAt: attribute.assignmentTimestamp,
  });

  const m2mVerifiedAttributeResponse = testToM2MGatewayApiVerifiedAttribute(
    mockVerifiedAttribute1
  );

  const mockVerifyVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);
  const mockGetTenant = vi.fn().mockResolvedValue(mockTenantProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      verifyVerifiedAttribute: mockVerifyVerifiedAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockVerifyVerifiedAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should add the verified attribute if found in the tenant", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const seed: m2mGatewayApi.TenantVerifiedAttributeSeed = {
      id: mockVerifiedAttribute1.id,
      agreementId: generateId(),
    };

    const result = await tenantService.addVerifiedAttribute(
      tenantId,
      seed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mVerifiedAttributeResponse);

    expect(mockVerifyVerifiedAttribute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: seed.id,
        agreementId: seed.agreementId,
      }),
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

    expect(mockGetTenant).toHaveBeenCalledTimes(1);
  });

  it("Should throw error if verified attribute not found after addition", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const unknownAttributeId = generateId();
    const seed: m2mGatewayApi.TenantVerifiedAttributeSeed = {
      id: unknownAttributeId,
      agreementId: generateId(),
    };

    await expect(
      tenantService.addVerifiedAttribute(
        tenantId,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      `Verified attribute ${unknownAttributeId} not found after assignment`
    );
  });

  it("Should throw error when polling exceeds max retries", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const seed: m2mGatewayApi.TenantVerifiedAttributeSeed = {
      id: mockVerifiedAttribute1.id,
      agreementId: generateId(),
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

    mockVerifyVerifiedAttribute.mockResolvedValue(mockFailedPollingResponse);
    mockGetTenant.mockResolvedValue(mockFailedPollingResponse);

    await expect(
      tenantService.addVerifiedAttribute(
        tenantId,
        seed,
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
    const seed: m2mGatewayApi.TenantVerifiedAttributeSeed = {
      id: mockVerifiedAttribute1.id,
      agreementId: generateId(),
    };

    const responseWithoutMetadata = {
      data: mockTenantProcessResponse.data,
    };

    mockVerifyVerifiedAttribute.mockResolvedValue(responseWithoutMetadata);
    mockGetTenant.mockResolvedValue(responseWithoutMetadata);

    await expect(
      tenantService.addVerifiedAttribute(
        tenantId,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });
});
