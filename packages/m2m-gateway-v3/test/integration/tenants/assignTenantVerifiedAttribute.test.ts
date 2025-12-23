import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
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

describe("assignTenantVerifiedAttribute", () => {
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

  const mockTenantVerifiedAttributeSeed: m2mGatewayApiV3.TenantVerifiedAttributeSeed =
  {
    id: mockVerifiedAttribute2.id,
    agreementId: generateId(),
    expirationDate: new Date().toISOString(),
  };

  const mockAddVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      verifyVerifiedAttribute: mockAddVerifiedAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddVerifiedAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantAttributeResponse: m2mGatewayApiV3.TenantVerifiedAttribute = {
      id: mockVerifiedAttribute2.id,
      assignedAt: mockVerifiedAttribute2.assignmentTimestamp,
    };

    const result = await tenantService.assignTenantVerifiedAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      mockTenantVerifiedAttributeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .verifyVerifiedAttribute,
      body: mockTenantVerifiedAttributeSeed,
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

  it("Should throw tenantVerifiedAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId = generateId();
    await expect(
      tenantService.assignTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        {
          ...mockTenantVerifiedAttributeSeed,
          id: nonExistentAttributeId,
        },
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
    mockAddVerifiedAttribute.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.assignTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        mockTenantVerifiedAttributeSeed,
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
      tenantService.assignTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        mockTenantVerifiedAttributeSeed,
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
      tenantService.assignTenantVerifiedAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        mockTenantVerifiedAttributeSeed,
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
