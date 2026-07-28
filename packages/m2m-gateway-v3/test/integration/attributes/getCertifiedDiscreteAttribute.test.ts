import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  getMockedApiAttribute,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  attributeService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getCertifiedAttributes integration", () => {
  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
    name: "Certified Discrete Attribute 1",
    code: "CERT001",
    description: "First certified discrete attribute",
  });

  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
    name: "Certified Discrete Attribute 2",
    code: "CERT002",
    description: "Second certified discrete attribute",
  });

  const mockAttribute3 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
    name: "Certified Discrete Attribute 3",
    code: "CERT003",
    description: "Third certified discrete attribute",
  });

  const mockAttributeProcessResponse = getMockWithMetadata({
    results: [mockAttribute1, mockAttribute2, mockAttribute3],
    totalCount: 3,
  });

  const testToM2MGatewayApiCertifiedDiscreteAttribute = (
    attribute: attributeRegistryApi.Attribute
  ): m2mGatewayApiV3.CertifiedDiscreteAttribute => ({
    id: attribute.id,
    code: attribute.code!,
    description: attribute.description,
    origin: attribute.origin!,
    name: attribute.name,
    createdAt: attribute.creationTime,
  });

  const m2mCertifiedDiscreteAttributeResponse1 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(mockAttribute1);

  const m2mCertifiedDiscreteAttributeResponse2 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(mockAttribute2);

  const m2mCertifiedDiscreteAttributeResponse3 =
    testToM2MGatewayApiCertifiedDiscreteAttribute(mockAttribute3);

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
    const m2mAttributesResponse: m2mGatewayApiV3.CertifiedDiscreteAttributes = {
      pagination: {
        limit: 10,
        offset: 0,
        totalCount: 3,
      },
      results: [
        m2mCertifiedDiscreteAttributeResponse1,
        m2mCertifiedDiscreteAttributeResponse2,
        m2mCertifiedDiscreteAttributeResponse3,
      ],
    };

    const result = await attributeService.getCertifiedDiscreteAttributes(
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mAttributesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 10,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE],
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

    const m2mCertifiedDiscreteAttributesResponse1: m2mGatewayApiV3.CertifiedDiscreteAttributes =
      {
        pagination: {
          offset: 0,
          limit: 2,
          totalCount: 3,
        },
        results: [
          m2mCertifiedDiscreteAttributeResponse1,
          m2mCertifiedDiscreteAttributeResponse2,
        ],
      };

    const result1 = await attributeService.getCertifiedDiscreteAttributes(
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result1).toStrictEqual(m2mCertifiedDiscreteAttributesResponse1);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 2,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE],
      },
    });

    const mockPaginatedResponse2 = getMockWithMetadata({
      results: [mockAttribute3],
      totalCount: 3,
    });

    mockInteropBeClients.attributeProcessClient.getAttributes =
      mockGetAttributes.mockResolvedValueOnce(mockPaginatedResponse2);

    const m2mCertifiedDiscreteAttributesResponse2: m2mGatewayApiV3.CertifiedDiscreteAttributes =
      {
        pagination: {
          offset: 2,
          limit: 2,
          totalCount: 3,
        },
        results: [m2mCertifiedDiscreteAttributeResponse3],
      };

    const result2 = await attributeService.getCertifiedDiscreteAttributes(
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result2).toStrictEqual(m2mCertifiedDiscreteAttributesResponse2);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 2,
        limit: 2,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE],
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

    const m2mEmptyResponse: m2mGatewayApiV3.CertifiedDiscreteAttributes = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 0,
      },
      results: [],
    };

    const result = await attributeService.getCertifiedDiscreteAttributes(
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mEmptyResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributes,
      queries: {
        offset: 0,
        limit: 10,
        kinds: [attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE],
      },
    });
  });
});
