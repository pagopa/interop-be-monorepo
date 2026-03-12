import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AttributeId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
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
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  tenantDeclaredAttributeNotFound,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeTenantDeclaredAttribute", () => {
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

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantAttributeResponse: m2mGatewayApi.TenantDeclaredAttribute = {
      id: mockDeclaredAttribute1.id,
      assignedAt: mockDeclaredAttribute1.assignmentTimestamp,
      revokedAt: mockDeclaredAttribute1.revocationTimestamp,
      delegationId: mockDeclaredAttribute1.delegationId,
    };

    const result = await tenantService.revokeTenantDeclaredAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      unsafeBrandId(mockDeclaredAttribute1.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .revokeDeclaredAttribute,
      params: {
        attributeId: mockDeclaredAttribute1.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: { id: mockTenantProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.tenantProcessClient.tenant.getTenant
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw tenantDeclaredAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId: AttributeId = generateId();
    await expect(
      tenantService.revokeTenantDeclaredAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        nonExistentAttributeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      tenantDeclaredAttributeNotFound(
        mockTenantProcessResponse.data,
        nonExistentAttributeId
      )
    );
  });

  it("Should throw missingMetadata in case the resource returned by the POST call has no metadata", async () => {
    mockRevokeDeclaredAttribute.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeTenantDeclaredAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockDeclaredAttribute1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetTenant.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeTenantDeclaredAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(unsafeBrandId(mockDeclaredAttribute1.id)),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetTenant.mockImplementation(
      mockPollingResponse(
        mockTenantProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      tenantService.revokeTenantDeclaredAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockDeclaredAttribute1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetTenant).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
