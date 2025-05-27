import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
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
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiTenant,
} from "../../mockUtils.js";

describe("addCertifiedAttribute", () => {
  const mockTenantCertifiedAttributeSeed: m2mGatewayApi.TenantCertifiedAttributeSeed =
    {
      id: generateId(),
    };
  const mockTenantProcessResponse = getMockedApiTenant();

  const mockAddCertifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      addCertifiedAttribute: mockAddCertifiedAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddCertifiedAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantResponse: m2mGatewayApi.Tenant = {
      id: mockTenantProcessResponse.data.id,
      createdAt: mockTenantProcessResponse.data.createdAt,
      externalId: {
        origin: mockTenantProcessResponse.data.externalId.origin,
        value: mockTenantProcessResponse.data.externalId.value,
      },
      name: mockTenantProcessResponse.data.name,
      kind: mockTenantProcessResponse.data.kind,
      onboardedAt: mockTenantProcessResponse.data.onboardedAt,
      subUnitType: mockTenantProcessResponse.data.subUnitType,
      updatedAt: mockTenantProcessResponse.data.updatedAt,
    };

    const result = await tenantService.addCertifiedAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      mockTenantCertifiedAttributeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTenantResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .addCertifiedAttribute,
      body: mockTenantCertifiedAttributeSeed,
      params: {
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

  it("Should throw missingMetadata in case the resource returned by the POST call has no metadata", async () => {
    mockAddCertifiedAttribute.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.addCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        mockTenantCertifiedAttributeSeed,
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
      tenantService.addCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        mockTenantCertifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetTenant.mockImplementation(
      mockPollingResponse(
        mockTenantProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      tenantService.addCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        mockTenantCertifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetTenant).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
