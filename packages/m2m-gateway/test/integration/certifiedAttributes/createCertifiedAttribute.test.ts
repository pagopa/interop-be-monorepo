import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import {
  attributeService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  resourcePollingTimeout,
  unexpectedAttributeKind,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";
import { getMockedApiAttribute } from "pagopa-interop-commons-test";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { getMockWithMetadata } from "pagopa-interop-commons-test";

describe("createCertifiedAttribute", () => {
  const mockCertifiedAttributeSeed: m2mGatewayApi.CertifiedAttributeSeed =
    generateMock(m2mGatewayApi.CertifiedAttributeSeed);

  const mockAttributeProcessResponse = getMockWithMetadata(
    getMockedApiAttribute({
      kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
      code: mockCertifiedAttributeSeed.code,
      name: mockCertifiedAttributeSeed.name,
      description: mockCertifiedAttributeSeed.description,
    })
  );

  const mockCreateCertifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockAttributeProcessResponse);

  const mockGetAttribute = vi.fn(
    mockPollingResponse(mockAttributeProcessResponse, 2)
  );

  mockInteropBeClients.attributeProcessClient = {
    createCertifiedAttribute: mockCreateCertifiedAttribute,
    getAttributeById: mockGetAttribute,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateCertifiedAttribute.mockClear();
    mockGetAttribute.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAttributeResponse: m2mGatewayApi.CertifiedAttribute = {
      id: mockAttributeProcessResponse.data.id,
      code: mockAttributeProcessResponse.data.code!,
      description: mockAttributeProcessResponse.data.description,
      origin: mockAttributeProcessResponse.data.origin!,
      name: mockAttributeProcessResponse.data.name,
      createdAt: mockAttributeProcessResponse.data.creationTime,
    };

    const result = await attributeService.createCertifiedAttribute(
      mockCertifiedAttributeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.attributeProcessClient.createCertifiedAttribute,
      body: mockCertifiedAttributeSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.attributeProcessClient.getAttributeById,
      params: { attributeId: mockAttributeProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.attributeProcessClient.getAttributeById
    ).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      attributeRegistryApi.AttributeKind.Values.VERIFIED,
      attributeRegistryApi.AttributeKind.Values.DECLARED,
    ],
  ])(
    "Should throw unexpectedAttributeKind in case the returned attribute has an unexpected kind",
    async (kind) => {
      const mockResponse = {
        ...mockAttributeProcessResponse,
        data: {
          ...mockAttributeProcessResponse.data,
          kind,
        },
      };

      mockInteropBeClients.attributeProcessClient.getAttributeById =
        mockGetAttribute.mockResolvedValueOnce(mockResponse);

      await expect(
        attributeService.createCertifiedAttribute(
          mockCertifiedAttributeSeed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrowError(unexpectedAttributeKind(mockResponse.data));
    }
  );

  it.each([
    { origin: undefined, code: "validCode" },
    { origin: "validOrigin", code: undefined },
    { origin: undefined, code: undefined },
  ])(
    "Should throw unexpectedUndefinedAttributeOriginOrCode in case the returned attribute has an unexpected kind",
    async (originAndCodeOverride) => {
      const mockResponse = {
        ...mockAttributeProcessResponse,
        data: {
          ...mockAttributeProcessResponse.data,
          ...originAndCodeOverride,
        },
      };

      mockInteropBeClients.attributeProcessClient.getAttributeById =
        mockGetAttribute.mockResolvedValueOnce(mockResponse);

      await expect(
        attributeService.createCertifiedAttribute(
          mockCertifiedAttributeSeed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrowError(
        unexpectedUndefinedAttributeOriginOrCode(mockResponse.data)
      );
    }
  );

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockCreateCertifiedAttribute.mockResolvedValueOnce({
      ...mockAttributeProcessResponse,
      metadata: undefined,
    });

    await expect(
      attributeService.createCertifiedAttribute(
        mockCertifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetAttribute.mockResolvedValueOnce({
      ...mockAttributeProcessResponse,
      metadata: undefined,
    });

    await expect(
      attributeService.createCertifiedAttribute(
        mockCertifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetAttribute.mockImplementation(
      mockPollingResponse(
        mockAttributeProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      attributeService.createCertifiedAttribute(
        mockCertifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetAttribute).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
