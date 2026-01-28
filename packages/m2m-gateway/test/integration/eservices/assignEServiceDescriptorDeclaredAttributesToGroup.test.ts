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
import { catalogApi } from "pagopa-interop-api-clients";
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
  eserviceDescriptorAttributeGroupNotFound,
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("assignEServiceDescriptorDeclaredAttributesToGroup", () => {
  const mockNewAttribute1 = getMockedApiEServiceAttribute();
  const mockNewAttribute2 = getMockedApiEServiceAttribute();
  const mockDeclaredAttributes = [
    [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
    [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
    [getMockedApiEServiceAttribute()],
  ];
  const mockDescriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.DRAFT,
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

  const mockGetEService = vi.fn();
  const mockPatchUpdateDescriptor = vi.fn();
  const mockUpdateDescriptorAttributes = vi.fn();

  mockGetEService.mockResolvedValue(mockGetEServiceResponse);
  mockPatchUpdateDescriptor.mockResolvedValue(mockGetEServiceResponse);
  mockUpdateDescriptorAttributes.mockResolvedValue(mockGetEServiceResponse);

  mockInteropBeClients.catalogProcessClient = {
    patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
    updateDescriptorAttributes: mockUpdateDescriptorAttributes,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPatchUpdateDescriptor.mockClear();
    mockUpdateDescriptorAttributes.mockClear();
    mockGetEService.mockClear();
  });

  it.each([0, 1, 2])(
    "Should succeed and perform API clients calls",
    async (groupIndex) => {
      mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
      mockGetEService.mockImplementation(
        mockPollingResponse(mockGetEServiceResponse, 2)
      );

      const seed = {
        attributeIds: [mockNewAttribute1.id, mockNewAttribute2.id],
      };

      await eserviceService.assignEServiceDescriptorDeclaredAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        groupIndex,
        seed,
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
                return [
                  ...group,
                  ...seed.attributeIds.map((id) => ({
                    id,
                  })),
                ];
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
    }
  );

  it("Should throw missingMetadata in case the eservice returned by the update PATCH call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);
    mockPatchUpdateDescriptor.mockResolvedValueOnce({
      ...mockGetEServiceResponse,
      metadata: undefined,
    });

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceService.assignEServiceDescriptorDeclaredAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        seed,
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

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceService.assignEServiceDescriptorDeclaredAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        seed,
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

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceService.assignEServiceDescriptorDeclaredAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1 // initial call + max retries
    );
  });

  it("Should throw eserviceDescriptorAttributeGroupNotFound in case of missing group for the specified group index", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceService.assignEServiceDescriptorDeclaredAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockDeclaredAttributes.length + 1,
        seed,
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

  it("Should throw eserviceDescriptorNotFound in case of eservice descriptor not found", async () => {
    mockGetEService.mockResolvedValueOnce(mockGetEServiceResponse);

    const descriptorId = generateId();
    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceService.assignEServiceDescriptorDeclaredAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(descriptorId),
        1,
        seed,
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
