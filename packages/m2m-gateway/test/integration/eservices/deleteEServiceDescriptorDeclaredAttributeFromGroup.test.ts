import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiEServiceAttribute,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  eserviceDescriptorAttributeNotFound,
  eserviceDescriptorAttributeGroupNotFound,
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEServiceDescriptorDeclaredAttributeFromGroup", () => {
  const mockAttribute = getMockedApiEServiceAttribute();
  const mockDeclaredAttributes = [
    [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
    [getMockedApiEServiceAttribute(), mockAttribute],
    [mockAttribute],
    [
      getMockedApiEServiceAttribute(),
      getMockedApiEServiceAttribute(),
      getMockedApiEServiceAttribute(),
    ],
  ];
  const mockDescriptor = getMockedApiEserviceDescriptor({
    attributes: {
      certified: [],
      declared: mockDeclaredAttributes,
      verified: [],
    },
  });
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor],
  });

  const mockGetEServiceResponse = getMockWithMetadata(mockEService);

  const mockGetEService = vi.fn(
    mockPollingResponse(mockGetEServiceResponse, 2)
  );

  const mockPatchUpdateDescriptor = vi
    .fn()
    .mockResolvedValue(mockGetEServiceResponse);

  mockInteropBeClients.catalogProcessClient = {
    patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPatchUpdateDescriptor.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    const groupIndex = 1;

    await eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockDescriptor.id),
      groupIndex,
      unsafeBrandId(mockAttribute.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
      body: {
        attributes: {
          certified: [],
          declared: mockDeclaredAttributes.map((group, index) => {
            if (index === groupIndex) {
              return group.filter((attr) => attr.id !== mockAttribute.id);
            }
            return group;
          }),
          verified: [],
        },
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should delete the whole group if the last attribute is removed", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    const groupIndex = 2;

    await eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockDescriptor.id),
      groupIndex,
      unsafeBrandId(mockAttribute.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
      body: {
        attributes: {
          certified: [],
          declared: mockDeclaredAttributes.filter(
            (_, index) => index !== groupIndex
          ),
          verified: [],
        },
      },
    });
  });

  it("Should throw missingMetadata in case the eservice returned by the update PATCH call has no metadata", async () => {
    mockPatchUpdateDescriptor.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        unsafeBrandId(mockAttribute.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockGetEService.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        unsafeBrandId(mockAttribute.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockGetEServiceResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        unsafeBrandId(mockAttribute.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });

  it("Should throw eserviceDescriptorAttributeGroupNotFound in case of missing group for the specified group index", async () => {
    await expect(
      eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockDeclaredAttributes.length + 1,
        unsafeBrandId(mockAttribute.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAttributeGroupNotFound(
        "declared",
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockDeclaredAttributes.length + 1
      )
    );
  });

  it("Should throw eserviceDescriptorAttributeNotFound in case of attribute not found", async () => {
    await expect(
      eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        unsafeBrandId(generateId()),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAttributeNotFound(unsafeBrandId(mockDescriptor.id))
    );
  });

  it("Should throw eserviceDescriptorNotFound in case of eservice descriptor not found", async () => {
    const descriptorId = generateId();
    await expect(
      eserviceService.deleteEServiceDescriptorDeclaredAttributeFromGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(descriptorId),
        1,
        unsafeBrandId(mockAttribute.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(descriptorId)
      )
    );
  });
});
