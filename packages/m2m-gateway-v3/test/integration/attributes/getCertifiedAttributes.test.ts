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

describe("getCertifiedAttributes integration", () => {
  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
    name: "Certified Attribute 1",
    code: "CERT001",
    description: "First certified attribute",
  });

  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
    name: "Certified Attribute 2",
    code: "CERT002",
    description: "Second certified attribute",
  });

  const mockAttribute3 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
    name: "Certified Attribute 3",
    code: "CERT003",
    description: "Third certified attribute",
  });

  const mockAttributeProcessResponse = getMockWithMetadata({
    results: [mockAttribute1, mockAttribute2, mockAttribute3],
    totalCount: 3,
  });

  const testToM2MGatewayApiCertifiedAttribute = (
    attribute: attributeRegistryApi.Attribute
  ): m2mGatewayApiV3.CertifiedAttribute => ({
    id: attribute.id,
    code: attribute.code!,
    description: attribute.description,
    origin: attribute.origin!,
    name: attribute.name,
    createdAt: attribute.creationTime,
  });

  const m2mCertifiedAttributeResponse1 =
    testToM2MGatewayApiCertifiedAttribute(mockAttribute1);

  const m2mCertifiedAttributeResponse2 =
    testToM2MGatewayApiCertifiedAttribute(mockAttribute2);

  const m2mCertifiedAttributeResponse3 =
    testToM2MGatewayApiCertifiedAttribute(mockAttribute3);

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
    const m2mAttributesResponse: m2mGatewayApiV3.CertifiedAttributes = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 3,
      },
      results: [
        m2mCertifiedAttributeResponse1,
        m2mCertifiedAttributeResponse2,
        m2mCertifiedAttributeResponse3,
      ],
    };

    const result = await attributeService.getCertifiedAttributes(
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAttributesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 10,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED],
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

    const m2mCertifiedAttributesResponse1: m2mGatewayApiV3.CertifiedAttributes = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: 3,
      },
      results: [m2mCertifiedAttributeResponse1, m2mCertifiedAttributeResponse2],
    };

    const result1 = await attributeService.getCertifiedAttributes(
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result1).toEqual(m2mCertifiedAttributesResponse1);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 2,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED],
      },
    });

    const mockPaginatedResponse2 = getMockWithMetadata({
      results: [mockAttribute3],
      totalCount: 3,
    });

    mockInteropBeClients.attributeProcessClient.getAttributes =
      mockGetAttributes.mockResolvedValueOnce(mockPaginatedResponse2);

    const m2mCertifiedAttributesResponse2: m2mGatewayApiV3.CertifiedAttributes = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: 3,
      },
      results: [m2mCertifiedAttributeResponse3],
    };

    const result2 = await attributeService.getCertifiedAttributes(
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result2).toEqual(m2mCertifiedAttributesResponse2);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 2,
        limit: 2,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED],
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

    const m2mEmptyResponse: m2mGatewayApiV3.CertifiedAttributes = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 0,
      },
      results: [],
    };

    const result = await attributeService.getCertifiedAttributes(
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEmptyResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 10,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED],
      },
    });
  });
});
