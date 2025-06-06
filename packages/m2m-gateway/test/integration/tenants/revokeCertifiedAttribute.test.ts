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
  tenantCertifiedAttributeNotFound,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiCertifiedTenantAttribute,
  getMockedApiTenant,
} from "../../mockUtils.js";

describe("revokeCertifiedAttribute", () => {
  const mockCertifiedAttribute1 = getMockedApiCertifiedTenantAttribute({
    revoked: true,
  });
  const mockCertifiedAttribute2 = getMockedApiCertifiedTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockedApiTenant({
    attributes: [
      {
        certified: mockCertifiedAttribute1,
      },
      {
        certified: mockCertifiedAttribute2,
      },
      ...otherMockedAttributes,
    ],
  });

  const mockRevokeCertifiedAttributeById = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      revokeCertifiedAttributeById: mockRevokeCertifiedAttributeById,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRevokeCertifiedAttributeById.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantAttributeResponse: m2mGatewayApi.TenantCertifiedAttribute = {
      id: mockCertifiedAttribute1.id,
      assignedAt: mockCertifiedAttribute1.assignmentTimestamp,
      revokedAt: mockCertifiedAttribute1.revocationTimestamp,
    };

    const result = await tenantService.revokeCertifiedAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      unsafeBrandId(mockCertifiedAttribute1.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .revokeCertifiedAttributeById,
      params: {
        attributeId: mockCertifiedAttribute1.id,
        tenantId: mockTenantProcessResponse.data.id,
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

  it("Should throw tenantCertifiedAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId: AttributeId = generateId();
    await expect(
      tenantService.revokeCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        nonExistentAttributeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      tenantCertifiedAttributeNotFound(
        mockTenantProcessResponse.data,
        nonExistentAttributeId
      )
    );
  });

  it("Should throw missingMetadata in case the resource returned by the POST call has no metadata", async () => {
    mockRevokeCertifiedAttributeById.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedAttribute1.id),
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
      tenantService.revokeCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(unsafeBrandId(mockCertifiedAttribute1.id)),
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
      tenantService.revokeCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedAttribute1.id),
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
