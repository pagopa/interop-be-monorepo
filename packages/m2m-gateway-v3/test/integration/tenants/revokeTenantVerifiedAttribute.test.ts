import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgreementId,
  AttributeId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiVerifiedTenantAttribute,
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
  tenantVerifiedAttributeNotFound,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeTenantVerifiedAttribute", () => {
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

  const mockAgreementId = generateId<AgreementId>();

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

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantAttributeResponse: m2mGatewayApiV3.TenantVerifiedAttribute = {
      id: mockVerifiedAttribute1.id,
      assignedAt: mockVerifiedAttribute1.assignmentTimestamp,
    };

    const result = await tenantService.revokeTenantVerifiedAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      unsafeBrandId(mockVerifiedAttribute1.id),
      mockAgreementId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .revokeVerifiedAttribute,
      params: {
        attributeId: mockVerifiedAttribute1.id,
        tenantId: mockTenantProcessResponse.data.id,
      },
      body: {
        agreementId: mockAgreementId,
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

  it("Should throw tenantVerifiedAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId: AttributeId = generateId();
    await expect(
      tenantService.revokeTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        nonExistentAttributeId,
        mockAgreementId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      tenantVerifiedAttributeNotFound(
        mockTenantProcessResponse.data,
        nonExistentAttributeId
      )
    );
  });

  it("Should throw missingMetadata in case the resource returned by the POST call has no metadata", async () => {
    mockRevokeVerifiedAttribute.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockVerifiedAttribute1.id),
        mockAgreementId,
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
      tenantService.revokeTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(unsafeBrandId(mockVerifiedAttribute1.id)),
        mockAgreementId,
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
      tenantService.revokeTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockVerifiedAttribute1.id),
        mockAgreementId,
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
