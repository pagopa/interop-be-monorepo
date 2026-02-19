import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  attributeRegistryApi,
  eserviceTemplateApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceTemplateVersionAttributeNotFound,
  eserviceTemplateVersionNotFound,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiVerifiedAttribute } from "../../../src/api/attributeApiConverter.js";

describe("getEserviceTemplateVersionVerifiedAttributes", () => {
  const attribute1: eserviceTemplateApi.Attribute = {
    id: generateId(),
  };

  const attribute2: eserviceTemplateApi.Attribute = {
    id: generateId(),
  };

  const attribute3: eserviceTemplateApi.Attribute = {
    id: generateId(),
  };

  const attribute4: eserviceTemplateApi.Attribute = {
    id: generateId(),
  };

  const attribute5: eserviceTemplateApi.Attribute = {
    id: generateId(),
  };

  const attribute6: eserviceTemplateApi.Attribute = {
    id: generateId(),
  };
  const bulkAttribute1: attributeRegistryApi.Attribute = {
    code: "code1",
    id: attribute1.id,
    name: "Attribute Name 1",
    creationTime: new Date().toISOString(),
    description: "Description 1",
    origin: "Origin 1",
    kind: "VERIFIED",
  };

  const bulkAttribute2: attributeRegistryApi.Attribute = {
    code: "code2",
    id: attribute2.id,
    name: "Attribute Name 2",
    creationTime: new Date().toISOString(),
    description: "Description 2",
    origin: "Origin 2",
    kind: "VERIFIED",
  };

  const bulkAttribute3: attributeRegistryApi.Attribute = {
    code: "code3",
    id: attribute3.id,
    name: "Attribute Name 3",
    creationTime: new Date().toISOString(),
    description: "Description 3",
    origin: "Origin 3",
    kind: "VERIFIED",
  };

  const version: eserviceTemplateApi.EServiceTemplateVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    attributes: {
      verified: [[attribute1, attribute2], [attribute3]],
      declared: [[attribute4, attribute5]],
      certified: [[attribute6]],
    },
  };

  const eserviceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    versions: [version],
  };

  const response: m2mGatewayApi.EServiceTemplateVersionVerifiedAttribute[] = [
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiVerifiedAttribute({
        attribute: bulkAttribute1,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiVerifiedAttribute({
        attribute: bulkAttribute2,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 1,
      attribute: toM2MGatewayApiVerifiedAttribute({
        attribute: bulkAttribute3,
        logger: genericLogger,
      }),
    },
  ];

  const mockEserviceTemplateResponse = getMockWithMetadata(eserviceTemplate);
  const mockGetEServiceTemplateById = vi
    .fn()
    .mockResolvedValue(mockEserviceTemplateResponse);
  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: {
      results: [bulkAttribute1, bulkAttribute2, bulkAttribute3],
      totalCount: version.attributes.verified.length,
    },
    metadata: {},
  });
  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplateById,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    mockGetEServiceTemplateById.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const attributes =
      await eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      );
    expect(attributes.results).toStrictEqual(response);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServiceTemplateById,
      params: { templateId: eserviceTemplate.id },
    });

    expect(mockGetBulkedAttributes).toHaveBeenCalledWith(
      [attribute1.id, attribute2.id, attribute3.id],
      expect.objectContaining({
        queries: { limit: 50, offset: 0 },
      })
    );
  });

  it("Should apply filters (offset, limit)", async () => {
    const response1: m2mGatewayApi.EServiceTemplateVersionVerifiedAttributes = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: 3,
      },
      results: [response[0], response[1]],
    };

    const result =
      await eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        { limit: 2, offset: 0 },
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual(response1);

    const response2: m2mGatewayApi.EServiceTemplateVersionVerifiedAttributes = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: 3,
      },
      results: [response[2]],
    };

    const result2 =
      await eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        { limit: 2, offset: 2 },
        getMockM2MAdminAppContext()
      );

    expect(result2).toStrictEqual(response2);
  });

  it("Should throw eserviceTemplateVersionNotFound in case the returned eserviceTemplate has no version with the given id", async () => {
    const nonExistingDescriptorId = generateId();
    await expect(
      eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(nonExistingDescriptorId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(nonExistingDescriptorId)
      )
    );
  });
  it("Should throw eserviceTemplateVersionAttributeNotFound in case an attribute ID is present but cannot be resolved by the Attribute Registry", async () => {
    const MISSING_ATTRIBUTE_ID = "00000000-0000-0000-0000-000000000001";

    const descriptorWithMissingAttribute: eserviceTemplateApi.EServiceTemplateVersion =
      {
        ...getMockedApiEserviceTemplateVersion(),
        attributes: {
          certified: [],
          declared: [],
          verified: [
            [
              {
                id: MISSING_ATTRIBUTE_ID,
              },
            ],
          ],
        },
      };

    const eserviceWithDescriptorWithoutAttribute: eserviceTemplateApi.EServiceTemplate =
      getMockedApiEServiceTemplate({
        versions: [descriptorWithMissingAttribute],
      });
    const mockEserviceTemplateResponse = getMockWithMetadata(
      eserviceWithDescriptorWithoutAttribute
    );
    const mockGetEServiceTemplateById = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateResponse);
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

    mockInteropBeClients.eserviceTemplateProcessClient = {
      getEServiceTemplateById: mockGetEServiceTemplateById,
    } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

    await expect(
      eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
        unsafeBrandId(eserviceWithDescriptorWithoutAttribute.id),
        unsafeBrandId(descriptorWithMissingAttribute.id),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionAttributeNotFound(
        descriptorWithMissingAttribute.id
      )
    );
  });
});
