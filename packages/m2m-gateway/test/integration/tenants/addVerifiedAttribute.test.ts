import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
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
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("addVerifiedAttribute", () => {
  const mockVerifiedAttribute = getMockedApiVerifiedTenantAttribute();
  const otherMockedAttributes = generateMock(
    z.array(tenantApi.TenantAttribute)
  );
  const mockTenantProcessResponse = getMockWithMetadata(
    getMockedApiTenant({
      attributes: [
        {
          verified: mockVerifiedAttribute,
        },
        ...otherMockedAttributes,
      ],
    })
  );

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

  it("should add verified attribute", async () => {
    const body: m2mGatewayApi.AddVerifiedAttributeRequest = {
      id: mockVerifiedAttribute.id,
      agreementId: generateId(),
      expirationDate: new Date().toISOString(),
    };

    const result = await tenantService.addTenantVerifiedAttribute(
      unsafeBrandId("test-tenant-id"),
      body,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockAddVerifiedAttribute,
      body: {
        id: body.id,
        expirationDate: body.expirationDate,
        agreementId: body.agreementId,
      },
      params: { tenantId: "test-tenant-id" },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetTenant,
      params: { id: expect.any(String) },
    });

    expect(result).toEqual({
      id: mockVerifiedAttribute.id,
      assignedAt: mockVerifiedAttribute.assignmentTimestamp,
    });
  });
});
