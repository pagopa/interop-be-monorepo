import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  attributeRegistryApi,
  catalogApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceDescriptorAttributeNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";

describe("getEserviceDescriptorDeclaredAttributes", () => {
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
      declared: [[attribute1, attribute2], [attribute3]],
      verified: [],
      certified: [],
    },
  };

  const eservice: catalogApi.EService = {
    ...getMockedApiEservice(),
    descriptors: [descriptor],
  };

  const response: m2mGatewayApi.EServiceDescriptorDeclaredAttribute[] = [
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiDeclaredAttribute({
        attribute: bulkAttribute1,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 0,
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
  ];

  const mockCatalogResponse = getMockWithMetadata(eservice);
  const mockGetEServiceById = vi.fn().mockResolvedValue(mockCatalogResponse);
  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: {
      results: [bulkAttribute1, bulkAttribute2, bulkAttribute3],
      totalCount: 3,
    },
    metadata: {},
  });
  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEServiceById,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    mockGetEServiceById.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const attributes =
      await eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      );
    expect(attributes.results).toEqual(response);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServiceById,
      params: { eServiceId: eservice.id },
    });
    expect(mockGetBulkedAttributes).toHaveBeenCalledWith(
      [attribute1.id, attribute2.id, attribute3.id],
      expect.objectContaining({
        queries: { limit: 10, offset: 0 },
      })
    );
  });

  it("Should apply filters (offset, limit)", async () => {
    const response1: m2mGatewayApi.EServiceDescriptorDeclaredAttributes = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: 2,
      },
      results: [response[0], response[1]],
    };

    const result =
      await eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        { limit: 2, offset: 0 },
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(response1);

    const response2: m2mGatewayApi.EServiceDescriptorDeclaredAttributes = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: 1,
      },
      results: [response[2]],
    };

    const result2 =
      await eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eservice.id),
        unsafeBrandId(descriptor.id),
        { limit: 2, offset: 2 },
        getMockM2MAdminAppContext()
      );

    expect(result2).toEqual(response2);
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId();
    await expect(
      eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eservice.id),
        unsafeBrandId(nonExistingDescriptorId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(eservice.id, nonExistingDescriptorId)
    );
  });
  it("Should throw eserviceDescriptorAttributeNotFound in case an attribute ID is present but cannot be resolved by the Attribute Registry", async () => {
    const MISSING_ATTRIBUTE_ID = "00000000-0000-0000-0000-000000000001";

    const descriptorWithMissingAttribute: catalogApi.EServiceDescriptor = {
      ...getMockedApiEserviceDescriptor(),
      attributes: {
        declared: [
          [{ id: MISSING_ATTRIBUTE_ID, explicitAttributeVerification: false }],
        ],
        certified: [],
        verified: [],
      },
    };

    const eserviceWithDescriptorWithoutAttribute: catalogApi.EService =
      getMockedApiEservice({ descriptors: [descriptorWithMissingAttribute] });
    const mockCatalogResponse = getMockWithMetadata(
      eserviceWithDescriptorWithoutAttribute
    );
    const mockGetEServiceById = vi.fn().mockResolvedValue(mockCatalogResponse);
    const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
      data: {
        results: [],
        totalCount: 0,
      },
      metadata: {},
    });

    mockInteropBeClients.attributeProcessClient = {
      getBulkedAttributes: mockGetBulkedAttributes,
    } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

    mockInteropBeClients.catalogProcessClient = {
      getEServiceById: mockGetEServiceById,
    } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

    await expect(
      eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eserviceWithDescriptorWithoutAttribute.id),
        unsafeBrandId(descriptorWithMissingAttribute.id),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAttributeNotFound(descriptorWithMissingAttribute.id)
    );
  });
});
