import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  getMockedApiAttribute,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  attributeService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getVerifiedAttributes integration", () => {
  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
    name: "Verified Attribute 1",
    description: "First verified attribute",
  });

  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
    name: "Verified Attribute 2",
    description: "Second verified attribute",
  });

  const mockAttribute3 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
    name: "Verified Attribute 3",
    description: "Third verified attribute",
  });

  const mockAttributeProcessResponse = getMockWithMetadata({
    results: [mockAttribute1, mockAttribute2, mockAttribute3],
    totalCount: 3,
  });

  const toVerified = (
    attribute: attributeRegistryApi.Attribute
  ): m2mGatewayApiV3.VerifiedAttribute => ({
    id: attribute.id,
    description: attribute.description,
    name: attribute.name,
    createdAt: attribute.creationTime,
  });

  const m2mVerifiedAttributeResponse1 = toVerified(mockAttribute1);
  const m2mVerifiedAttributeResponse2 = toVerified(mockAttribute2);
  const m2mVerifiedAttributeResponse3 = toVerified(mockAttribute3);

  const mockGetAttributes = vi
    .fn()
    .mockResolvedValue(mockAttributeProcessResponse);

  mockInteropBeClients.attributeProcessClient = {
    getAttributes: mockGetAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    mockGetAttributes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedResponse = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 3,
      },
      results: [
        m2mVerifiedAttributeResponse1,
        m2mVerifiedAttributeResponse2,
        m2mVerifiedAttributeResponse3,
      ],
    };

    const result = await attributeService.getVerifiedAttributes(
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 10,
        kinds: [attributeRegistryApi.AttributeKind.Values.VERIFIED],
      },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const mockPaginatedResponse1 = getMockWithMetadata({
      results: [mockAttribute1, mockAttribute2],
      totalCount: 3,
    });

    mockInteropBeClients.attributeProcessClient.getAttributes =
      mockGetAttributes.mockResolvedValueOnce(mockPaginatedResponse1);

    const expected1 = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: 3,
      },
      results: [m2mVerifiedAttributeResponse1, m2mVerifiedAttributeResponse2],
    };

    const result1 = await attributeService.getVerifiedAttributes(
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result1).toEqual(expected1);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 2,
        kinds: [attributeRegistryApi.AttributeKind.Values.VERIFIED],
      },
    });

    const mockPaginatedResponse2 = getMockWithMetadata({
      results: [mockAttribute3],
      totalCount: 3,
    });

    mockInteropBeClients.attributeProcessClient.getAttributes =
      mockGetAttributes.mockResolvedValueOnce(mockPaginatedResponse2);

    const expected2 = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: 3,
      },
      results: [m2mVerifiedAttributeResponse3],
    };

    const result2 = await attributeService.getVerifiedAttributes(
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result2).toEqual(expected2);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 2,
        limit: 2,
        kinds: [attributeRegistryApi.AttributeKind.Values.VERIFIED],
      },
    });
  });

  it("Should handle empty results", async () => {
    const mockEmptyResponse = getMockWithMetadata({
      results: [],
      totalCount: 0,
    });

    mockInteropBeClients.attributeProcessClient.getAttributes =
      mockGetAttributes.mockResolvedValueOnce(mockEmptyResponse);

    const expectedEmpty = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 0,
      },
      results: [],
    };

    const result = await attributeService.getVerifiedAttributes(
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedEmpty);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 10,
        kinds: [attributeRegistryApi.AttributeKind.Values.VERIFIED],
      },
    });
  });
});
