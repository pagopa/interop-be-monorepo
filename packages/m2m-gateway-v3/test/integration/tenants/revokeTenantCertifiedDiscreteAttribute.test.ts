import { generateMock } from "@anatine/zod-mock";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockedApiCertifiedDiscreteTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  tenantCertifiedDiscreteAttributeNotFound,
} from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  tenantService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("revokeTenantCertifiedDiscreteAttribute", () => {
  const mockCertifiedDiscreteAttribute1 =
    getMockedApiCertifiedDiscreteTenantAttribute({
      revoked: true,
    });
  const mockCertifiedDiscreteAttribute2 =
    getMockedApiCertifiedDiscreteTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute1,
        },
        {
          certifiedDiscrete: mockCertifiedDiscreteAttribute2,
        },
        ...otherMockedAttributes,
      ],
    })
  );

  const mockRevokeCertifiedDiscreteAttributeById = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      revokeCertifiedDiscreteAttributeById:
        mockRevokeCertifiedDiscreteAttributeById,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRevokeCertifiedDiscreteAttributeById.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTenantAttributeResponse: m2mGatewayApiV3.TenantCertifiedDiscreteAttribute =
      {
        id: mockCertifiedDiscreteAttribute1.id,
        discreteValue: mockCertifiedDiscreteAttribute1.discreteValue,
        assignedAt: mockCertifiedDiscreteAttribute1.assignmentTimestamp,
        revokedAt: mockCertifiedDiscreteAttribute1.revocationTimestamp,
      };

    const result = await tenantService.revokeTenantCertifiedDiscreteAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      unsafeBrandId(mockCertifiedDiscreteAttribute1.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .revokeCertifiedDiscreteAttributeById,
      params: {
        attributeId: mockCertifiedDiscreteAttribute1.id,
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

  it("Should throw tenantCertifiedDiscreteAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId: AttributeId = generateId();
    await expect(
      tenantService.revokeTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        nonExistentAttributeId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      tenantCertifiedDiscreteAttributeNotFound(
        mockTenantProcessResponse.data,
        nonExistentAttributeId
      )
    );
  });

  it("Should throw missingMetadata in case the resource returned by the POST call has no metadata", async () => {
    mockRevokeCertifiedDiscreteAttributeById.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedDiscreteAttribute1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetTenant.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.revokeTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(unsafeBrandId(mockCertifiedDiscreteAttribute1.id)),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetTenant.mockImplementation(
      mockPollingResponse(
        mockTenantProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      tenantService.revokeTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedDiscreteAttribute1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
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
