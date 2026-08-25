import { generateMock } from "@anatine/zod-mock";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  getMockedApiAttribute,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  unexpectedAttributeKind,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";
import {
  attributeService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createCertifiedDiscreteAttribute", () => {
  const mockCertifiedDiscreteAttributeSeed: m2mGatewayApiV3.CertifiedDiscreteAttributeSeed =
    generateMock(m2mGatewayApiV3.CertifiedDiscreteAttributeSeed);

  const mockAttributeProcessResponse = getMockWithMetadata(
    getMockedApiAttribute({
      kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
      code: mockCertifiedDiscreteAttributeSeed.code,
      name: mockCertifiedDiscreteAttributeSeed.name,
      description: mockCertifiedDiscreteAttributeSeed.description,
    })
  );

  const mockCreateCertifiedDiscreteAttribute = vi
    .fn()
    .mockResolvedValue(mockAttributeProcessResponse);

  const mockGetAttribute = vi.fn(
    mockPollingResponse(mockAttributeProcessResponse, 2)
  );

  mockInteropBeClients.attributeProcessClient = {
    createCertifiedDiscreteAttribute: mockCreateCertifiedDiscreteAttribute,
    getAttributeById: mockGetAttribute,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateCertifiedDiscreteAttribute.mockClear();
    mockGetAttribute.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAttributeResponse: m2mGatewayApiV3.CertifiedDiscreteAttribute = {
      id: mockAttributeProcessResponse.data.id,
      code: mockAttributeProcessResponse.data.code!,
      description: mockAttributeProcessResponse.data.description,
      origin: mockAttributeProcessResponse.data.origin!,
      name: mockAttributeProcessResponse.data.name,
      createdAt: mockAttributeProcessResponse.data.creationTime,
    };

    const result = await attributeService.createCertifiedDiscreteAttribute(
      mockCertifiedDiscreteAttributeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.attributeProcessClient
          .createCertifiedDiscreteAttribute,
      body: mockCertifiedDiscreteAttributeSeed,
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
    [attributeRegistryApi.AttributeKind.Values.VERIFIED],
    [attributeRegistryApi.AttributeKind.Values.DECLARED],
    [attributeRegistryApi.AttributeKind.Values.CERTIFIED],
  ])(
    "Should throw unexpectedAttributeKind in case the returned attribute has unexpected kind: %s",
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
        attributeService.createCertifiedDiscreteAttribute(
          mockCertifiedDiscreteAttributeSeed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrow(unexpectedAttributeKind(mockResponse.data));
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
        attributeService.createCertifiedDiscreteAttribute(
          mockCertifiedDiscreteAttributeSeed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrow(
        unexpectedUndefinedAttributeOriginOrCode(mockResponse.data)
      );
    }
  );

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockCreateCertifiedDiscreteAttribute.mockResolvedValueOnce({
      ...mockAttributeProcessResponse,
      metadata: undefined,
    });

    await expect(
      attributeService.createCertifiedDiscreteAttribute(
        mockCertifiedDiscreteAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetAttribute.mockResolvedValueOnce({
      ...mockAttributeProcessResponse,
      metadata: undefined,
    });

    await expect(
      attributeService.createCertifiedDiscreteAttribute(
        mockCertifiedDiscreteAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAttribute.mockImplementation(
      mockPollingResponse(
        mockAttributeProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      attributeService.createCertifiedDiscreteAttribute(
        mockCertifiedDiscreteAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetAttribute).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
