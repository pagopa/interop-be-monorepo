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

describe("getDeclaredAttributes integration", () => {
  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
    name: "Declared Attribute 1",
    description: "First declared attribute",
  });

  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
    name: "Declared Attribute 2",
    description: "Second declared attribute",
  });

  const mockAttribute3 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
    name: "Declared Attribute 3",
    description: "Third declared attribute",
  });

  const mockAttributeProcessResponse = getMockWithMetadata({
    results: [mockAttribute1, mockAttribute2, mockAttribute3],
    totalCount: 3,
  });

  const toDeclared = (
    attribute: attributeRegistryApi.Attribute
  ): m2mGatewayApiV3.DeclaredAttribute => ({
    id: attribute.id,
    description: attribute.description,
    name: attribute.name,
    createdAt: attribute.creationTime,
  });

  const m2mDeclaredAttributeResponse1 = toDeclared(mockAttribute1);
  const m2mDeclaredAttributeResponse2 = toDeclared(mockAttribute2);
  const m2mDeclaredAttributeResponse3 = toDeclared(mockAttribute3);

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
        m2mDeclaredAttributeResponse1,
        m2mDeclaredAttributeResponse2,
        m2mDeclaredAttributeResponse3,
      ],
    };

    const result = await attributeService.getDeclaredAttributes(
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
        kinds: [attributeRegistryApi.AttributeKind.Values.DECLARED],
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
      results: [m2mDeclaredAttributeResponse1, m2mDeclaredAttributeResponse2],
    };

    const result1 = await attributeService.getDeclaredAttributes(
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
        kinds: [attributeRegistryApi.AttributeKind.Values.DECLARED],
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
      results: [m2mDeclaredAttributeResponse3],
    };

    const result2 = await attributeService.getDeclaredAttributes(
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
        kinds: [attributeRegistryApi.AttributeKind.Values.DECLARED],
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

    const result = await attributeService.getDeclaredAttributes(
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
        kinds: [attributeRegistryApi.AttributeKind.Values.DECLARED],
      },
    });
  });
});
