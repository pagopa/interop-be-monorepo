import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockM2MAdminAppContext } from "pagopa-interop-commons-test/src/testUtils.js";
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
import { getMockedApiAttribute, getMockedApiTenant } from "../../mockUtils.js";

describe("revokeCertifiedAttribute", () => {
  const mockCertifiedAttribute = getMockedApiAttribute();
  const mockTenantProcessResponse = getMockedApiTenant({
    attributes: [
      {
        certified: {
          id: mockCertifiedAttribute.data.id,
          assignmentTimestamp: new Date().toISOString(),
        },
      },
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
    const result = await tenantService.revokeCertifiedAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      unsafeBrandId(mockCertifiedAttribute.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .revokeCertifiedAttributeById,
      params: {
        attributeId: mockCertifiedAttribute.data.id,
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
    mockRevokeCertifiedAttributeById.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedAttribute.data.id),
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
        unsafeBrandId(mockCertifiedAttribute.data.id),
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
      tenantService.revokeCertifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedAttribute.data.id),
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
