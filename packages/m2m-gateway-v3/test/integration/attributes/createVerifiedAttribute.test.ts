import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import {
  getMockedApiAttribute,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
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
  unexpectedAttributeKind,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createVerifiedAttribute", () => {
  const mockVerifiedAttributeSeed: m2mGatewayApiV3.VerifiedAttributeSeed =
    generateMock(m2mGatewayApiV3.VerifiedAttributeSeed);

  const mockAttributeProcessResponse = getMockWithMetadata(
    getMockedApiAttribute({
      kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
      name: mockVerifiedAttributeSeed.name,
      description: mockVerifiedAttributeSeed.description,
    })
  );

  const mockCreateVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockAttributeProcessResponse);

  const mockGetAttribute = vi.fn(
    mockPollingResponse(mockAttributeProcessResponse, 2)
  );

  mockInteropBeClients.attributeProcessClient = {
    createVerifiedAttribute: mockCreateVerifiedAttribute,
    getAttributeById: mockGetAttribute,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateVerifiedAttribute.mockClear();
    mockGetAttribute.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAttributeResponse: m2mGatewayApiV3.VerifiedAttribute = {
      id: mockAttributeProcessResponse.data.id,
      description: mockAttributeProcessResponse.data.description,
      name: mockAttributeProcessResponse.data.name,
      createdAt: mockAttributeProcessResponse.data.creationTime,
    };

    const result = await attributeService.createVerifiedAttribute(
      mockVerifiedAttributeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mAttributeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.attributeProcessClient.createVerifiedAttribute,
      body: mockVerifiedAttributeSeed,
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
      attributeRegistryApi.AttributeKind.Values.DECLARED,
      attributeRegistryApi.AttributeKind.Values.CERTIFIED,
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
        attributeService.createVerifiedAttribute(
          mockVerifiedAttributeSeed,
          getMockM2MAdminAppContext()
        )
      ).rejects.toThrowError(unexpectedAttributeKind(mockResponse.data));
    }
  );

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockCreateVerifiedAttribute.mockResolvedValueOnce({
      ...mockAttributeProcessResponse,
      metadata: undefined,
    });

    await expect(
      attributeService.createVerifiedAttribute(
        mockVerifiedAttributeSeed,
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
      attributeService.createVerifiedAttribute(
        mockVerifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAttribute.mockImplementation(
      mockPollingResponse(
        mockAttributeProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      attributeService.createVerifiedAttribute(
        mockVerifiedAttributeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
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
