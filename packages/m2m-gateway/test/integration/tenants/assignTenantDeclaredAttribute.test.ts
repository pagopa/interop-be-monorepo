import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
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
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("assignTenantDeclaredAttribute", () => {
  const mockDeclaredAttribute = getMockedApiDeclaredTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          declared: mockDeclaredAttribute,
        },
        ...otherMockedAttributes,
      ],
    })
  );

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

  it("should add declared attribute with delegation ID", async () => {
    const body: m2mGatewayApi.AddDeclaredAttributeRequest = {
      id: mockDeclaredAttribute.id,
      delegationId: generateId(),
    };

    const result = await tenantService.addTenantDeclaredAttribute(
      unsafeBrandId("test-tenant-id"),
      body,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockAddDeclaredAttribute,
      body: {
        id: body.id,
        delegationId: body.delegationId,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenant,
      params: { id: expect.any(String) },
    });

    expect(result).toEqual({
      id: mockDeclaredAttribute.id,
      assignedAt: mockDeclaredAttribute.assignmentTimestamp,
      revokedAt: mockDeclaredAttribute.revocationTimestamp,
      delegationId: mockDeclaredAttribute.delegationId,
    });
  });

  it("should add declared attribute without delegation ID", async () => {
    const mockDeclaredAttributeWithoutDelegation = {
      ...mockDeclaredAttribute,
      delegationId: undefined,
    };

    const mockTenantProcessResponseWithoutDelegation = getMockWithMetadata(
      getMockedApiTenant({
        attributes: [
          {
            declared: mockDeclaredAttributeWithoutDelegation,
          },
          ...otherMockedAttributes,
        ],
      })
    );

    mockAddDeclaredAttribute.mockResolvedValueOnce(
      mockTenantProcessResponseWithoutDelegation
    );
    mockGetTenant.mockResolvedValueOnce(
      mockTenantProcessResponseWithoutDelegation
    );

    const body: m2mGatewayApi.AddDeclaredAttributeRequest = {
      id: mockDeclaredAttribute.id,
    };

    const result = await tenantService.addTenantDeclaredAttribute(
      unsafeBrandId("test-tenant-id"),
      body,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockAddDeclaredAttribute,
      body: {
        id: body.id,
        delegationId: undefined,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenant,
      params: { id: expect.any(String) },
    });

    expect(result).toEqual({
      id: mockDeclaredAttributeWithoutDelegation.id,
      assignedAt: mockDeclaredAttributeWithoutDelegation.assignmentTimestamp,
      revokedAt: mockDeclaredAttributeWithoutDelegation.revocationTimestamp,
      delegationId: undefined,
    });
  });
});
