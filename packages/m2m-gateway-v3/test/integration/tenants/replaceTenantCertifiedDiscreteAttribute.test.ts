import { generateMock } from "@anatine/zod-mock";
import { m2mGatewayApiV3, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockedApiCertifiedDiscreteTenantAttribute,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
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

describe("replaceTenantCertifiedDiscreteAttribute", () => {
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

  const mockTenantCertifiedDiscreteAttributeSeed: m2mGatewayApiV3.UpdateTenantCertifiedDiscreteAttributeSeed =
    {
      certifiedDiscreteValue:
        mockCertifiedDiscreteAttribute2.discreteValue === 17520
          ? 17521
          : mockCertifiedDiscreteAttribute2.discreteValue + 1,
    };

  const mockUpdateCertifiedDiscreteAttributeById = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      updateCertifiedDiscreteAttributeById:
        mockUpdateCertifiedDiscreteAttributeById,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    mockUpdateCertifiedDiscreteAttributeById.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedResponse: m2mGatewayApiV3.TenantCertifiedDiscreteAttribute = {
      id: mockCertifiedDiscreteAttribute1.id,
      discreteValue:
        mockTenantCertifiedDiscreteAttributeSeed.certifiedDiscreteValue,
      assignedAt: mockCertifiedDiscreteAttribute1.assignmentTimestamp,
      revokedAt: mockCertifiedDiscreteAttribute1.revocationTimestamp,
    };

    const updatedMockTenantProcessResponse = {
      ...mockTenantProcessResponse,
      data: {
        ...mockTenantProcessResponse.data,
        attributes: [
          {
            certifiedDiscrete: {
              ...mockCertifiedDiscreteAttribute1,
              discreteValue:
                mockTenantCertifiedDiscreteAttributeSeed.certifiedDiscreteValue,
            },
          },
          {
            certifiedDiscrete: mockCertifiedDiscreteAttribute2,
          },
          ...otherMockedAttributes,
        ],
      },
    };

    mockUpdateCertifiedDiscreteAttributeById.mockResolvedValueOnce(
      updatedMockTenantProcessResponse
    );

    mockGetTenant.mockResolvedValueOnce(updatedMockTenantProcessResponse);

    const result = await tenantService.replaceTenantCertifiedDiscreteAttribute(
      unsafeBrandId(mockTenantProcessResponse.data.id),
      unsafeBrandId(mockCertifiedDiscreteAttribute1.id),
      mockTenantCertifiedDiscreteAttributeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockUpdateCertifiedDiscreteAttributeById,
      body: mockTenantCertifiedDiscreteAttributeSeed,
      params: {
        tenantId: mockTenantProcessResponse.data.id,
        attributeId: mockCertifiedDiscreteAttribute1.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenant,
      params: { id: mockTenantProcessResponse.data.id },
    });
    expect(mockGetTenant).toHaveBeenCalledTimes(1);
  });

  it("Should throw tenantCertifiedDiscreteAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId = generateId();

    await expect(
      tenantService.replaceTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(nonExistentAttributeId),
        {
          certifiedDiscreteValue: 5270,
        },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      tenantCertifiedDiscreteAttributeNotFound(
        mockTenantProcessResponse.data,
        nonExistentAttributeId
      )
    );
  });

  it("Should throw missingMetadata in case the resource returned by the PUT call has no metadata", async () => {
    mockUpdateCertifiedDiscreteAttributeById.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.replaceTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedDiscreteAttribute2.id),
        mockTenantCertifiedDiscreteAttributeSeed,
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
      tenantService.replaceTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedDiscreteAttribute2.id),
        mockTenantCertifiedDiscreteAttributeSeed,
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
      tenantService.replaceTenantCertifiedDiscreteAttribute(
        unsafeBrandId(mockTenantProcessResponse.data.id),
        unsafeBrandId(mockCertifiedDiscreteAttribute2.id),
        mockTenantCertifiedDiscreteAttributeSeed,
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
