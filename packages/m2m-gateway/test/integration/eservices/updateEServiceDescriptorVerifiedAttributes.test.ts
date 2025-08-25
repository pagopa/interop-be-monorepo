import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  DescriptorId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  defaultExplicitAttributeVerification,
  getMockM2MAdminAppContext,
} from "../../mockUtils.js";

describe("updateEServiceDescriptorVerifiedAttributes", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor, getMockedApiEserviceDescriptor()],
  });

  const m2mAttributes: m2mGatewayApi.EServiceDescriptorAttributes = [
    [{ id: generateId() }],
    [{ id: generateId() }, { id: generateId() }],
  ];
  const expectedResponse: m2mGatewayApi.EServiceDescriptorVerifiedAttributesResponse =
    {
      verifiedAttributes: m2mAttributes,
    };
  const eserviceAttributes =
    defaultExplicitAttributeVerification(m2mAttributes);

  const mockEServiceProcessResponse = getMockWithMetadata({
    ...mockEService,
    descriptors: [
      {
        ...mockDescriptor,
        attributes: {
          ...mockDescriptor.attributes,
          verified: eserviceAttributes,
        },
      },
      mockEService.descriptors[1],
    ],
  });

  const mockPatchUpdateDescriptor = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPatchUpdateDescriptor.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result =
      await eserviceService.updateEServiceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        m2mAttributes,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(expectedResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
      body: { attributes: { verified: eserviceAttributes } },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId<DescriptorId>();
    await expect(
      eserviceService.updateEServiceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        nonExistingDescriptorId,
        m2mAttributes,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(mockEService.id, nonExistingDescriptorId)
    );
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockPatchUpdateDescriptor.mockResolvedValueOnce({
      ...mockEServiceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateEServiceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        m2mAttributes,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockEServiceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateEServiceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        m2mAttributes,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockEServiceProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.updateEServiceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        m2mAttributes,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
