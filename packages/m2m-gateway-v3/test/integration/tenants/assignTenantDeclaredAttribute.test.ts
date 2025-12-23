import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  delegationApi,
  m2mGatewayApiV3,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  TenantId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  getMockedApiDeclaredTenantAttribute,
  getMockedApiDelegation,
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
  cannotEditDeclaredAttributesForTenant,
  missingMetadata,
  requesterIsNotTheDelegateConsumer,
  tenantDeclaredAttributeNotFound,
} from "../../../src/model/errors.js";
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

  const mockGetDelegation = vi
    .fn()
    .mockResolvedValue(getMockWithMetadata(mockConsumerDelegation));

  mockInteropBeClients.tenantProcessClient = {
    tenantAttribute: {
      addDeclaredAttribute: mockAddDeclaredAttribute,
    },
    tenant: {
      getTenant: mockGetTenant,
    },
  } as unknown as PagoPAInteropBeClients["tenantProcessClient"];

  mockInteropBeClients.delegationProcessClient = {
    delegation: { getDelegation: mockGetDelegation },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

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

    expect(result).toEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .addDeclaredAttribute,
      body: {
        ...mockTenantDeclaredAttributeSeed,
        delegationId: undefined,
      },
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
    mockGetDelegation.mockResolvedValueOnce(
      getMockWithMetadata(mockConsumerDelegation)
    );

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

    expect(result).toEqual(m2mTenantAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.tenantProcessClient.tenantAttribute
          .addDeclaredAttribute,
      body: {
        ...mockTenantDeclaredAttributeSeed,
        delegationId: mockConsumerDelegation.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.tenantProcessClient.tenant.getTenant,
      params: { id: mockTenantId },
    });
  });

  it(`Should throw cannotEditDeclaredAttributesForTenant when requester
      is not target tenant and no delegationId is provided`, async () => {
    await expect(
      tenantService.assignTenantDeclaredAttribute(
        unsafeBrandId(mockTenantId),
        mockTenantDeclaredAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      cannotEditDeclaredAttributesForTenant(mockTenantId, undefined)
    );
  });

  it(`Should throw cannotEditDeclaredAttributesForTenant when requester
      is delegate consumer for delegation id, but targetTenant is not the delegator`, async () => {
    const targetTenantId = generateId<TenantId>();
    await expect(
      tenantService.assignTenantDeclaredAttribute(
        targetTenantId,
        {
          ...mockTenantDeclaredAttributeSeed,
          delegationId: mockConsumerDelegation.id,
        },
        getMockM2MAdminAppContext({
          organizationId: unsafeBrandId<TenantId>(
            mockConsumerDelegation.delegateId
          ),
        })
      )
    ).rejects.toThrowError(
      cannotEditDeclaredAttributesForTenant(
        targetTenantId,
        mockConsumerDelegation
      )
    );
  });

  it(`Should throw requesterIsNotTheDelegateConsumer when requester is not delegate consumer for
       delegation id, even when requester is target tenant`, async () => {
    await expect(
      tenantService.assignTenantDeclaredAttribute(
        mockTenantId,
        {
          ...mockTenantDeclaredAttributeSeed,
          delegationId: mockConsumerDelegation.id,
        },
        getMockM2MAdminAppContext({})
      )
    ).rejects.toThrowError(
      requesterIsNotTheDelegateConsumer(mockConsumerDelegation)
    );

    await expect(
      tenantService.assignTenantDeclaredAttribute(
        mockTenantId,
        {
          ...mockTenantDeclaredAttributeSeed,
          delegationId: mockConsumerDelegation.id,
        },
        getMockM2MAdminAppContext({ organizationId: mockTenantId })
      )
    ).rejects.toThrowError(
      requesterIsNotTheDelegateConsumer(mockConsumerDelegation)
    );
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
