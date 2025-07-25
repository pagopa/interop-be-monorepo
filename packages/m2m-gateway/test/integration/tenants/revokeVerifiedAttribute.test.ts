import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import {
  generateId,
  unsafeBrandId,
  TenantId,
  AttributeId,
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
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeVerifiedAttribute", () => {
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

  const mockRevokeVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);
  const mockGetTenant = vi.fn().mockResolvedValue(mockTenantProcessResponse);

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      revokeVerifiedAttribute: mockRevokeVerifiedAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockRevokeVerifiedAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should revoke the verified attribute if found in the tenant", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const attributeId: AttributeId = unsafeBrandId(mockVerifiedAttribute1.id);
    const agreementId = generateId();

    const result = await tenantService.revokeVerifiedAttribute(
      tenantId,
      attributeId,
      agreementId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mVerifiedAttributeResponse);

    expect(mockRevokeVerifiedAttribute).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
          "X-Correlation-Id": expect.any(String),
        }),
        params: expect.objectContaining({
          attributeId: mockVerifiedAttribute1.id,
          tenantId: mockTenantProcessResponse.data.id,
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

  it("Should throw error if verified attribute not found after revocation", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const unknownAttributeId: AttributeId = generateId();
    const agreementId = generateId();

    await expect(
      tenantService.revokeVerifiedAttribute(
        tenantId,
        unknownAttributeId,
        agreementId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      `Verified attribute ${unknownAttributeId} not found after revocation`
    );
  });

  it("Should throw error when agreementId is not provided", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const attributeId: AttributeId = unsafeBrandId(mockVerifiedAttribute1.id);

    await expect(
      tenantService.revokeVerifiedAttribute(
        tenantId,
        attributeId,
        undefined,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      "Agreement ID is required for verified attribute revocation"
    );
  });

  it("Should throw error when response metadata is missing", async () => {
    const tenantId: TenantId = unsafeBrandId(mockTenantProcessResponse.data.id);
    const attributeId: AttributeId = unsafeBrandId(mockVerifiedAttribute1.id);
    const agreementId = generateId();

    mockGetTenant.mockResolvedValue({
      data: mockTenantProcessResponse.data,
    });

    await expect(
      tenantService.revokeVerifiedAttribute(
        tenantId,
        attributeId,
        agreementId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });
});
