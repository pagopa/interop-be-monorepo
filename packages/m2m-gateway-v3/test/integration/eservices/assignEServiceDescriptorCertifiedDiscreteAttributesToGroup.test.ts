import { attributeRegistryApi, catalogApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiEServiceAttribute,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, vi, beforeEach, expect } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceDescriptorAttributeGroupNotFound,
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  eserviceService,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

const getMockedApiCertifiedDiscreteEServiceAttribute =
  (): catalogApi.Attribute => ({
    ...getMockedApiEServiceAttribute(),
    discreteConfig: {
      threshold: 1,
      comparator: catalogApi.AttributeCertifiedDiscreteComparator.Values.EQ,
    },
  });

describe("assignEServiceDescriptorCertifiedDiscreteAttributesToGroup", () => {
  const mockNewAttribute1 = getMockedApiCertifiedDiscreteEServiceAttribute();
  const mockNewAttribute2 = getMockedApiCertifiedDiscreteEServiceAttribute();
  const mockCertifiedDiscreteAttributes = [
    [
      getMockedApiCertifiedDiscreteEServiceAttribute(),
      getMockedApiCertifiedDiscreteEServiceAttribute(),
    ],
    [
      getMockedApiCertifiedDiscreteEServiceAttribute(),
      getMockedApiCertifiedDiscreteEServiceAttribute(),
    ],
    [getMockedApiCertifiedDiscreteEServiceAttribute()],
  ];
  const mockDescriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.DRAFT,
    attributes: {
      certified: mockCertifiedDiscreteAttributes,
      declared: [],
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
  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: {
      results: [mockNewAttribute1.id, mockNewAttribute2.id].map((id) => ({
        id,
        code: `code-${id}`,
        name: `name-${id}`,
        creationTime: new Date().toISOString(),
        description: `description-${id}`,
        origin: "Origin",
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
      })),
      totalCount: 2,
    },
    metadata: {},
  });

  mockGetEService.mockResolvedValue(mockGetEServiceResponse);
  mockPatchUpdateDescriptor.mockResolvedValue(mockGetEServiceResponse);
  mockUpdateDescriptorAttributes.mockResolvedValue(mockGetEServiceResponse);

  mockInteropBeClients.catalogProcessClient = {
    patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
    updateDescriptorAttributes: mockUpdateDescriptorAttributes,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    mockPatchUpdateDescriptor.mockClear();
    mockUpdateDescriptorAttributes.mockClear();
    mockGetEService.mockClear();
    mockGetBulkedAttributes.mockClear();
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

      await eserviceService.assignEServiceDescriptorCertifiedDiscreteAttributesToGroup(
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
            certified: mockCertifiedDiscreteAttributes.map((group, index) => {
              if (index === groupIndex) {
                return [
                  ...group,
                  ...seed.attributeIds.map((id) => ({
                    id,
                    explicitAttributeVerification: false,
                    discreteConfig: group[0]?.discreteConfig,
                  })),
                ];
              }
              return group;
            }),
            declared: [],
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
      eserviceService.assignEServiceDescriptorCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
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
      eserviceService.assignEServiceDescriptorCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
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
      eserviceService.assignEServiceDescriptorCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
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
      eserviceService.assignEServiceDescriptorCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockCertifiedDiscreteAttributes.length + 1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      eserviceDescriptorAttributeGroupNotFound(
        "certified",
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockCertifiedDiscreteAttributes.length + 1
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
      eserviceService.assignEServiceDescriptorCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(descriptorId),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      eserviceDescriptorNotFound(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(descriptorId)
      )
    );
  });
});
