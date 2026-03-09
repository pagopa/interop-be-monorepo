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
import { attributeNotFound } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getDeclaredAttribute", () => {
  const mockAttributeProcessResponse = getMockWithMetadata(
    getMockedApiAttribute({
      kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
    })
  );
  const mockGetAttribute = vi
    .fn()
    .mockResolvedValue(mockAttributeProcessResponse);

  mockInteropBeClients.attributeProcessClient = {
    getAttributeById: mockGetAttribute,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetAttribute.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAttributeResponse: m2mGatewayApiV3.DeclaredAttribute = {
      id: mockAttributeProcessResponse.data.id,
      description: mockAttributeProcessResponse.data.description,
      name: mockAttributeProcessResponse.data.name,
      createdAt: mockAttributeProcessResponse.data.creationTime,
    };

    const result = await attributeService.getDeclaredAttribute(
      mockAttributeProcessResponse.data.id,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mAttributeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetAttribute,
      params: { attributeId: mockAttributeProcessResponse.data.id },
    });
  });

  it("Should throw attributeNotFound in case the returned attribute has an unexpected kind", async () => {
    const mockResponse = {
      ...mockAttributeProcessResponse,
      data: {
        ...mockAttributeProcessResponse.data,
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
      },
    };

    mockGetAttribute.mockResolvedValueOnce(mockResponse);

    await expect(
      attributeService.getDeclaredAttribute(
        mockAttributeProcessResponse.data.id,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(attributeNotFound(mockResponse.data));
  });
});
