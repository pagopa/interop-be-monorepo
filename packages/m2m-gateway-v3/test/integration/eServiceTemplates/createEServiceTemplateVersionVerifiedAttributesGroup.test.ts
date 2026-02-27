import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";

import { genericLogger } from "pagopa-interop-commons";
import { toM2MGatewayApiVerifiedAttribute } from "../../../src/api/attributeApiConverter.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceTemplateVersionAttributeNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("createEServiceTemplateVersionVerifiedAttributesGroup", () => {
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
      verified: [[attribute1, attribute2, attribute3]],
      declared: [],
      certified: [],
    },
  };

  const seed: m2mGatewayApiV3.EServiceTemplateVersionAttributesGroupSeed = {
    attributeIds: [attribute1.id, attribute2.id, attribute3.id],
  };

  const eserviceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    versions: [version],
  };

  const versionUpdated: eserviceTemplateApi.EServiceTemplateVersion = {
    ...version,
    attributes: {
      verified: [
        [attribute1, attribute2, attribute3],
        seed.attributeIds.map((id) => ({
          id,
          explicitAttributeVerification: false,
        })),
      ],
      declared: [],
      certified: [],
    },
  };

  const eserviceTemplateUpdated: eserviceTemplateApi.EServiceTemplate = {
    ...eserviceTemplate,
    versions: [versionUpdated],
  };

  const metadataUpdatedEserviceTemplate = getMockWithMetadata(
    eserviceTemplateUpdated
  );

  const mockGetEServiceTemplateById = vi.fn();

  mockGetEServiceTemplateById.mockResolvedValueOnce(
    getMockWithMetadata(eserviceTemplate)
  );

  mockGetEServiceTemplateById.mockImplementationOnce(
    mockPollingResponse(metadataUpdatedEserviceTemplate, 2)
  );

  mockGetEServiceTemplateById.mockResolvedValue(
    metadataUpdatedEserviceTemplate
  );

  const mockPatchUpdateDraftTemplateVersion = vi
    .fn()
    .mockResolvedValue(metadataUpdatedEserviceTemplate);

  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: {
      results: [bulkAttribute1, bulkAttribute2, bulkAttribute3],
      totalCount: version.attributes.certified.length,
    },
    metadata: {},
  });
  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplateById,
    patchUpdateDraftTemplateVersion: mockPatchUpdateDraftTemplateVersion,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  const response: m2mGatewayApiV3.EServiceTemplateVersionVerifiedAttributesGroup =
    {
      attributes: [
        {
          groupIndex: 1,
          attribute: toM2MGatewayApiVerifiedAttribute({
            attribute: bulkAttribute1,
            logger: genericLogger,
          }),
        },
        {
          groupIndex: 1,
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
      ],
    };

  beforeEach(() => {
    mockPatchUpdateDraftTemplateVersion.mockClear();
    mockGetEServiceTemplateById.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result =
      await eserviceTemplateService.createEServiceTemplateVersionVerifiedAttributesGroup(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        seed,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(response);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: eserviceTemplate.id },
    });

    expect(mockGetBulkedAttributes).toHaveBeenCalledWith(
      [attribute1.id, attribute2.id, attribute3.id],
      expect.objectContaining({
        queries: { limit: 50, offset: 0 },
      })
    );
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .patchUpdateDraftTemplateVersion,
      params: {
        templateId: eserviceTemplate.id,
        templateVersionId: version.id,
      },
      body: {
        attributes: versionUpdated.attributes,
      },
    });
    expect(mockGetEServiceTemplateById).toHaveBeenCalledTimes(3);
  });

  it("Should throw missingMetadata in case the attribute returned by the update PATCH call has no metadata", async () => {
    mockPatchUpdateDraftTemplateVersion.mockResolvedValueOnce({
      ...metadataUpdatedEserviceTemplate,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.createEServiceTemplateVersionVerifiedAttributesGroup(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplateById.mockResolvedValueOnce(
      getMockWithMetadata(eserviceTemplate)
    );
    mockPatchUpdateDraftTemplateVersion.mockResolvedValueOnce(
      metadataUpdatedEserviceTemplate
    );
    mockGetEServiceTemplateById.mockResolvedValueOnce({
      ...metadataUpdatedEserviceTemplate,
      metadata: undefined,
    });
    mockGetEServiceTemplateById.mockResolvedValue(
      metadataUpdatedEserviceTemplate
    );

    await expect(
      eserviceTemplateService.createEServiceTemplateVersionVerifiedAttributesGroup(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
    expect(mockGetEServiceTemplateById).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplateById.mockReset();
    mockGetEServiceTemplateById.mockResolvedValueOnce(
      getMockWithMetadata(eserviceTemplate)
    );
    mockPatchUpdateDraftTemplateVersion.mockResolvedValueOnce(
      metadataUpdatedEserviceTemplate
    );
    const nonFinalStateEservice = {
      ...metadataUpdatedEserviceTemplate,
      descriptors: [
        {
          ...versionUpdated,
          state: "DRAFT",
        },
      ],
    };

    mockGetEServiceTemplateById.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(nonFinalStateEservice),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.createEServiceTemplateVersionVerifiedAttributesGroup(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );

    expect(mockGetEServiceTemplateById).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });

  it("Should throw eserviceTemplateVersionAttributeNotFound in case an attribute ID is present but cannot be resolved by the Attribute Registry", async () => {
    const MISSING_ATTRIBUTE_ID = "00000000-0000-0000-0000-000000000001";

    const versionWithMissingAttribute: eserviceTemplateApi.EServiceTemplateVersion =
      {
        ...getMockedApiEserviceTemplateVersion(),
        attributes: {
          verified: [
            [
              {
                id: MISSING_ATTRIBUTE_ID,
                explicitAttributeVerification: false,
              },
            ],
          ],
          certified: [],
          declared: [],
        },
      };

    const eserviceTemplateWithVersionWithoutAttribute: eserviceTemplateApi.EServiceTemplate =
      getMockedApiEServiceTemplate({
        versions: [versionWithMissingAttribute],
      });
    const mockEserviceTemplateResponse = getMockWithMetadata(
      eserviceTemplateWithVersionWithoutAttribute
    );
    const mockGetEServiceTemplateById = vi.fn();

    mockGetEServiceTemplateById.mockImplementation(
      mockPollingResponse(mockEserviceTemplateResponse, 3)
    );

    const mockPatchUpdateDraftTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateResponse);

    const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
      data: {
        results: [],
        totalCount: 0,
      },
      metadata: {},
    });

    mockGetEServiceTemplateById.mockResolvedValueOnce(
      getMockWithMetadata(eserviceTemplateWithVersionWithoutAttribute)
    );

    mockInteropBeClients.attributeProcessClient = {
      getBulkedAttributes: mockGetBulkedAttributes,
    } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

    mockInteropBeClients.eserviceTemplateProcessClient = {
      getEServiceTemplateById: mockGetEServiceTemplateById,
      patchUpdateDraftTemplateVersion: mockPatchUpdateDraftTemplateVersion,
    } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

    await expect(
      eserviceTemplateService.createEServiceTemplateVersionVerifiedAttributesGroup(
        unsafeBrandId(eserviceTemplateWithVersionWithoutAttribute.id),
        unsafeBrandId(versionWithMissingAttribute.id),
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionAttributeNotFound(versionWithMissingAttribute.id)
    );
  });
});
