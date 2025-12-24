import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attributeRegistryApi,
  catalogApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";

import { genericLogger } from "pagopa-interop-commons";
import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceDescriptorAttributeNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("createEServiceDescriptorDeclaredAttributesGroup", () => {
  const attribute1: catalogApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const attribute2: catalogApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const attribute3: catalogApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const bulkAttribute1: attributeRegistryApi.Attribute = {
    code: "code1",
    id: attribute1.id,
    name: "Attribute Name 1",
    creationTime: new Date().toISOString(),
    description: "Description 1",
    origin: "Origin 1",
    kind: "DECLARED",
  };

  const bulkAttribute2: attributeRegistryApi.Attribute = {
    code: "code2",
    id: attribute2.id,
    name: "Attribute Name 2",
    creationTime: new Date().toISOString(),
    description: "Description 2",
    origin: "Origin 2",
    kind: "DECLARED",
  };

  const bulkAttribute3: attributeRegistryApi.Attribute = {
    code: "code3",
    id: attribute3.id,
    name: "Attribute Name 3",
    creationTime: new Date().toISOString(),
    description: "Description 3",
    origin: "Origin 3",
    kind: "DECLARED",
  };

  const descriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    attributes: {
      declared: [[attribute1, attribute2, attribute3]],
      verified: [],
      certified: [],
    },
  };

  const seed: m2mGatewayApiV3.EServiceDescriptorAttributesGroupSeed = {
    attributeIds: [attribute1.id, attribute2.id, attribute3.id],
  };

  const eservice: catalogApi.EService = {
    ...getMockedApiEservice(),
    descriptors: [descriptor],
  };

  const descriptorUpdated: catalogApi.EServiceDescriptor = {
    ...descriptor,
    attributes: {
      declared: [
        [attribute1, attribute2, attribute3],
        seed.attributeIds.map((id) => ({
          id,
          explicitAttributeVerification: false,
        })),
      ],
      verified: [],
      certified: [],
    },
  };

  const eserviceUpdated: catalogApi.EService = {
    ...eservice,
    descriptors: [descriptorUpdated],
  };

  const metadataUpdatedEservice = getMockWithMetadata(eserviceUpdated);

  const mockGetEServiceById = vi.fn();

  mockGetEServiceById.mockResolvedValueOnce(getMockWithMetadata(eservice));

  mockGetEServiceById.mockImplementationOnce(
    mockPollingResponse(metadataUpdatedEservice, 2)
  );

  mockGetEServiceById.mockResolvedValue(metadataUpdatedEservice);

  const mockPatchUpdateDescriptor = vi
    .fn()
    .mockResolvedValue(metadataUpdatedEservice);

  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: {
      results: [bulkAttribute1, bulkAttribute2, bulkAttribute3],
      totalCount: descriptor.attributes.certified.length,
    },
    metadata: {},
  });
  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEServiceById,
    patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  const response: m2mGatewayApiV3.EServiceDescriptorDeclaredAttributesGroup = {
    attributes: [
      {
        groupIndex: 1,
        attribute: toM2MGatewayApiDeclaredAttribute({
          attribute: bulkAttribute1,
          logger: genericLogger,
        }),
      },
      {
        groupIndex: 1,
        attribute: toM2MGatewayApiDeclaredAttribute({
          attribute: bulkAttribute2,
          logger: genericLogger,
        }),
      },
      {
        groupIndex: 1,
        attribute: toM2MGatewayApiDeclaredAttribute({
          attribute: bulkAttribute3,
          logger: genericLogger,
        }),
      },
    ],
  };

  beforeEach(() => {
    mockPatchUpdateDescriptor.mockClear();
    mockGetEServiceById.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result =
      await eserviceService.createEServiceDescriptorDeclaredAttributesGroup(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        seed,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(response);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: eservice.id },
    });

    expect(mockGetBulkedAttributes).toHaveBeenCalledWith(
      [attribute1.id, attribute2.id, attribute3.id],
      expect.objectContaining({
        queries: { limit: 50, offset: 0 },
      })
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor,
      params: {
        eServiceId: eservice.id,
        descriptorId: descriptor.id,
      },
      body: {
        attributes: descriptorUpdated.attributes,
      },
    });
    expect(mockGetEServiceById).toHaveBeenCalledTimes(3);
  });

  it("Should throw missingMetadata in case the attribute returned by the update PATCH call has no metadata", async () => {
    mockPatchUpdateDescriptor.mockResolvedValueOnce({
      ...metadataUpdatedEservice,
      metadata: undefined,
    });

    await expect(
      eserviceService.createEServiceDescriptorDeclaredAttributesGroup(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEServiceById.mockResolvedValueOnce(getMockWithMetadata(eservice));
    mockPatchUpdateDescriptor.mockResolvedValueOnce(metadataUpdatedEservice);
    mockGetEServiceById.mockResolvedValueOnce({
      ...metadataUpdatedEservice,
      metadata: undefined,
    });
    mockGetEServiceById.mockResolvedValue(metadataUpdatedEservice);

    await expect(
      eserviceService.createEServiceDescriptorDeclaredAttributesGroup(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
    expect(mockGetEServiceById).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceById.mockReset();
    mockGetEServiceById.mockResolvedValueOnce(getMockWithMetadata(eservice));
    mockPatchUpdateDescriptor.mockResolvedValueOnce(metadataUpdatedEservice);
    const nonFinalStateEservice = {
      ...metadataUpdatedEservice,
      descriptors: [
        {
          ...descriptorUpdated,
          state: "DRAFT",
        },
      ],
    };

    mockGetEServiceById.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(nonFinalStateEservice),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.createEServiceDescriptorDeclaredAttributesGroup(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );

    expect(mockGetEServiceById).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });
  it("Should throw eserviceDescriptorAttributeNotFound in case an attribute ID is present but cannot be resolved by the Attribute Registry", async () => {
    const MISSING_ATTRIBUTE_ID = "00000000-0000-0000-0000-000000000001";

    const descriptorWithMissingAttribute: catalogApi.EServiceDescriptor = {
      ...getMockedApiEserviceDescriptor(),
      attributes: {
        declared: [
          [
            {
              id: MISSING_ATTRIBUTE_ID,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
        certified: [],
      },
    };

    const eserviceWithDescriptorWithoutAttribute: catalogApi.EService =
      getMockedApiEservice({
        descriptors: [descriptorWithMissingAttribute],
      });
    const mockEserviceResponse = getMockWithMetadata(
      eserviceWithDescriptorWithoutAttribute
    );

    const mockGetEServiceById = vi.fn();

    mockGetEServiceById.mockImplementation(
      mockPollingResponse(mockEserviceResponse, 3)
    );

    const mockPatchUpdateDescriptor = vi
      .fn()
      .mockResolvedValue(mockEserviceResponse);

    const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
      data: {
        results: [],
        totalCount: 0,
      },
      metadata: {},
    });

    mockGetEServiceById.mockResolvedValueOnce(
      getMockWithMetadata(eserviceWithDescriptorWithoutAttribute)
    );

    mockInteropBeClients.attributeProcessClient = {
      getBulkedAttributes: mockGetBulkedAttributes,
    } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

    mockInteropBeClients.catalogProcessClient = {
      getEServiceById: mockGetEServiceById,
      patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
    } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

    await expect(
      eserviceService.createEServiceDescriptorDeclaredAttributesGroup(
        unsafeBrandId(eserviceWithDescriptorWithoutAttribute.id),
        unsafeBrandId(descriptorWithMissingAttribute.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAttributeNotFound(descriptorWithMissingAttribute.id)
    );
  });
});
