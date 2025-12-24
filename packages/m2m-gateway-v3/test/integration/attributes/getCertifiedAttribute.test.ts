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

describe("getCertifiedAttribute", () => {
  const mockAttributeProcessResponse = getMockWithMetadata(
    getMockedApiAttribute({
      kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
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
    const m2mAttributeResponse: m2mGatewayApiV3.CertifiedAttribute = {
      id: mockAttributeProcessResponse.data.id,
      code: mockAttributeProcessResponse.data.code!,
      description: mockAttributeProcessResponse.data.description,
      origin: mockAttributeProcessResponse.data.origin!,
      name: mockAttributeProcessResponse.data.name,
      createdAt: mockAttributeProcessResponse.data.creationTime,
    };

    const result = await attributeService.getCertifiedAttribute(
      mockAttributeProcessResponse.data.id,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAttributeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributeById,
      params: { attributeId: mockAttributeProcessResponse.data.id },
    });
  });

  it("Should throw attributeNotFound in case the returned attribute has an unexpected kind", async () => {
    const mockResponse = {
      ...mockAttributeProcessResponse,
      data: {
        ...mockAttributeProcessResponse.data,
        kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
      },
    };

    mockInteropBeClients.attributeProcessClient.getAttributeById =
      mockGetAttribute.mockResolvedValueOnce(mockResponse);

    await expect(
      attributeService.getCertifiedAttribute(
        mockAttributeProcessResponse.data.id,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(attributeNotFound(mockResponse.data));
  });

  it.each([
    { origin: undefined, code: "validCode" },
    { origin: "validOrigin", code: undefined },
    { origin: undefined, code: undefined },
  ])(
    "Should throw attributeNotFound in case the returned attribute has an undefined origin or code",
    async ({ origin, code }) => {
      const mockResponse = {
        ...mockAttributeProcessResponse,
        data: {
          ...mockAttributeProcessResponse.data,
          origin,
          code,
        },
      };

      mockInteropBeClients.attributeProcessClient.getAttributeById =
        mockGetAttribute.mockResolvedValueOnce(mockResponse);

      await expect(
        attributeService.getCertifiedAttribute(
          mockAttributeProcessResponse.data.id,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrowError(attributeNotFound(mockResponse.data));
    }
  );
});
