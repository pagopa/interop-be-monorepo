import { generateMock } from "@anatine/zod-mock";
import {
  delegationApi,
  m2mGatewayApiV3,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  getMockedApiDeclaredTenantAttribute,
  getMockedApiDelegation,
  getMockedApiTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  TenantId,
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
  tenantDeclaredAttributeNotFound,
} from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  tenantService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("assignTenantDeclaredAttribute", () => {
  const mockDeclaredAttribute1 = getMockedApiDeclaredTenantAttribute({
    revoked: true,
  });
  const mockDeclaredAttribute2 = getMockedApiDeclaredTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );

  const mockTenant = getMockedApiTenant({
    attributes: [
      {
        declared: mockDeclaredAttribute1,
      },
      {
        declared: mockDeclaredAttribute2,
      },
      ...otherMockedAttributes,
    ],
  });
  const mockTenantId: TenantId = unsafeBrandId(mockTenant.id);
  const mockTenantProcessResponse = getMockWithMetadata(mockTenant);

  const mockTenantDeclaredAttributeSeed: m2mGatewayApiV3.TenantDeclaredAttributeSeed =
    {
      id: mockDeclaredAttribute2.id,
    };

  const mockConsumerDelegation: delegationApi.Delegation =
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      state: delegationApi.DelegationState.Values.ACTIVE,
      delegatorId: mockTenantId,
    });

  const mockAddDeclaredAttribute = vi
    .fn()
    .mockResolvedValue(mockTenantProcessResponse);

  const mockGetTenant = vi.fn(
    mockPollingResponse(mockTenantProcessResponse, 2)
  );

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      addDeclaredAttribute: mockAddDeclaredAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockAddDeclaredAttribute.mockClear();
    mockGetTenant.mockClear();
  });

  it("Should succeed and perform API clients calls when requester is target tenant", async () => {
    const m2mTenantAttributeResponse: m2mGatewayApiV3.TenantDeclaredAttribute =
      {
        id: mockDeclaredAttribute2.id,
        assignedAt: mockDeclaredAttribute2.assignmentTimestamp,
        revokedAt: mockDeclaredAttribute2.revocationTimestamp,
        delegationId: mockDeclaredAttribute2.delegationId,
      };

    const result = await tenantService.assignTenantDeclaredAttribute(
      unsafeBrandId(mockTenantId),
      mockTenantDeclaredAttributeSeed,
      getMockM2MAdminAppContext({ organizationId: mockTenantId })
    );

    expect(result).toStrictEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .addDeclaredAttribute,
      body: {
        ...mockTenantDeclaredAttributeSeed,
        delegationId: undefined,
      },
      params: { tenantId: mockTenantId },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: { id: mockTenantId },
    });
    expect(
      mockInteropBeClients.tenantProcessClient.tenant.getTenant
    ).toHaveBeenCalledTimes(2);
  });

  it(`Should succeed and perform API clients calls when requester is delegate
      consumer of target tenant`, async () => {
    const m2mTenantAttributeResponse: m2mGatewayApiV3.TenantDeclaredAttribute =
      {
        id: mockDeclaredAttribute2.id,
        assignedAt: mockDeclaredAttribute2.assignmentTimestamp,
        revokedAt: mockDeclaredAttribute2.revocationTimestamp,
        delegationId: mockDeclaredAttribute2.delegationId,
      };

    const result = await tenantService.assignTenantDeclaredAttribute(
      unsafeBrandId(mockTenantId),
      {
        ...mockTenantDeclaredAttributeSeed,
        delegationId: mockConsumerDelegation.id,
      },
      getMockM2MAdminAppContext({
        organizationId: unsafeBrandId<TenantId>(
          mockConsumerDelegation.delegateId
        ),
      })
    );

    expect(result).toStrictEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .addDeclaredAttribute,
      body: {
        ...mockTenantDeclaredAttributeSeed,
        delegationId: mockConsumerDelegation.id,
      },
      params: { tenantId: mockTenantId },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: { id: mockTenantId },
    });
  });

  it("Should throw tenantDeclaredAttributeNotFound in case the attribute is not found in the tenant", async () => {
    const nonExistentAttributeId = generateId();
    await expect(
      tenantService.assignTenantDeclaredAttribute(
        unsafeBrandId(mockTenantId),
        { id: nonExistentAttributeId },
        getMockM2MAdminAppContext({ organizationId: mockTenantId })
      )
    ).rejects.toThrowError(
      tenantDeclaredAttributeNotFound(
        mockTenantProcessResponse.data,
        nonExistentAttributeId
      )
    );
  });

  it("Should throw missingMetadata in case the resource returned by the POST call has no metadata", async () => {
    mockAddDeclaredAttribute.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.assignTenantDeclaredAttribute(
        unsafeBrandId(mockTenantId),
        mockTenantDeclaredAttributeSeed,
        getMockM2MAdminAppContext({ organizationId: mockTenantId })
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetTenant.mockResolvedValueOnce({
      ...mockTenantProcessResponse,
      metadata: undefined,
    });

    await expect(
      tenantService.assignTenantDeclaredAttribute(
        unsafeBrandId(mockTenantId),
        mockTenantDeclaredAttributeSeed,
        getMockM2MAdminAppContext({ organizationId: mockTenantId })
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
      tenantService.assignTenantDeclaredAttribute(
        unsafeBrandId(mockTenantId),
        mockTenantDeclaredAttributeSeed,
        getMockM2MAdminAppContext({ organizationId: mockTenantId })
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
