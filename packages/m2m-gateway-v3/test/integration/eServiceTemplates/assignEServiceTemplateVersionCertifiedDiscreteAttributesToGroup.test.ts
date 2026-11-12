import {
  catalogApi,
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiEServiceAttribute,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
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
  eserviceTemplateVersionAttributeGroupNotFound,
  eserviceTemplateVersionNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceTemplateService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

const getMockedApiCertifiedDiscreteEServiceAttribute =
  (): eserviceTemplateApi.Attribute => ({
    id: generateId(),
    explicitAttributeVerification: false,
    discreteConfig: {
      threshold: 1,
      comparator: catalogApi.AttributeCertifiedDiscreteComparator.Values.EQ,
    },
  });

describe("assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup", () => {
  const mockNewAttribute1 = getMockedApiCertifiedDiscreteEServiceAttribute();
  const mockNewAttribute2 = getMockedApiCertifiedDiscreteEServiceAttribute();
  const mockCertifiedDiscreteAttributes = [
    [getMockedApiEServiceAttribute()],
    [
      getMockedApiEServiceAttribute(),
      getMockedApiCertifiedDiscreteEServiceAttribute(),
    ],
    [
      getMockedApiCertifiedDiscreteEServiceAttribute(),
      getMockedApiCertifiedDiscreteEServiceAttribute(),
    ],
    [getMockedApiCertifiedDiscreteEServiceAttribute()],
  ];
  const mockVersion = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Values.DRAFT,
    attributes: {
      certified: mockCertifiedDiscreteAttributes,
      declared: [],
      verified: [],
    },
  });
  const mockEServiceTemplate = getMockedApiEServiceTemplate({
    versions: [mockVersion],
  });

  const mockGetEServiceTemplateResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const mockGetEServiceTemplate = vi.fn();
  const mockPatchUpdateTemplateVersion = vi.fn();
  const mockUpdateTemplateVersionAttributes = vi.fn();

  mockGetEServiceTemplate.mockResolvedValue(mockGetEServiceTemplateResponse);
  mockPatchUpdateTemplateVersion.mockResolvedValue(
    mockGetEServiceTemplateResponse
  );
  mockUpdateTemplateVersionAttributes.mockResolvedValue(
    mockGetEServiceTemplateResponse
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    patchUpdateDraftTemplateVersion: mockPatchUpdateTemplateVersion,
    updateTemplateVersionAttributes: mockUpdateTemplateVersionAttributes,
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdateTemplateVersion.mockClear();
    mockUpdateTemplateVersionAttributes.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it.each([1, 2, 3])(
    "Should assign to the certified-discrete group using its original index %s",
    async (groupIndex) => {
      mockGetEServiceTemplate.mockResolvedValueOnce(
        mockGetEServiceTemplateResponse
      );
      mockGetEServiceTemplate.mockImplementation(
        mockPollingResponse(mockGetEServiceTemplateResponse, 2)
      );

      const seed: m2mGatewayApiV3.EServiceTemplateVersionCertifiedDiscreteAttributesGroupSeed =
        {
          attributes: [mockNewAttribute1, mockNewAttribute2].map(
            ({ id, discreteConfig }) => ({
              id,
              discreteConfig: discreteConfig!,
            })
          ),
        };

      await eserviceTemplateService.assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        groupIndex,
        seed,
        getMockM2MAdminAppContext()
      );

      expectApiClientPostToHaveBeenCalledWith({
        mockPost:
          mockInteropBeClients.eserviceTemplateProcessClient
            .patchUpdateDraftTemplateVersion,
        params: {
          templateId: mockEServiceTemplate.id,
          templateVersionId: mockVersion.id,
        },
        body: {
          attributes: {
            certified: mockCertifiedDiscreteAttributes.map((group, index) => {
              if (index === groupIndex) {
                return [
                  ...group,
                  ...seed.attributes.map(({ id, discreteConfig }) => ({
                    id,
                    explicitAttributeVerification: false,
                    discreteConfig,
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
        mockGet:
          mockInteropBeClients.eserviceTemplateProcessClient
            .getEServiceTemplateById,
        params: { templateId: mockEServiceTemplate.id },
      });
      expect(
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById
      ).toHaveBeenCalledTimes(3);
    }
  );

  it("Should throw missingMetadata in case the eservice template returned by the update PATCH call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockPatchUpdateTemplateVersion.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    const seed: m2mGatewayApiV3.EServiceTemplateVersionCertifiedDiscreteAttributesGroupSeed =
      {
        attributes: [mockNewAttribute1].map(({ id, discreteConfig }) => ({
          id,
          discreteConfig: discreteConfig!,
        })),
      };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    const seed: m2mGatewayApiV3.EServiceTemplateVersionCertifiedDiscreteAttributesGroupSeed =
      {
        attributes: [mockNewAttribute1].map(({ id, discreteConfig }) => ({
          id,
          discreteConfig: discreteConfig!,
        })),
      };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        mockGetEServiceTemplateResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    const seed: m2mGatewayApiV3.EServiceTemplateVersionCertifiedDiscreteAttributesGroupSeed =
      {
        attributes: [mockNewAttribute1].map(({ id, discreteConfig }) => ({
          id,
          discreteConfig: discreteConfig!,
        })),
      };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
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
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });

  it("Should throw eserviceTemplateVersionAttributeGroupNotFound in case of missing group for the specified group index", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    const seed: m2mGatewayApiV3.EServiceTemplateVersionCertifiedDiscreteAttributesGroupSeed =
      {
        attributes: [mockNewAttribute1].map(({ id, discreteConfig }) => ({
          id,
          discreteConfig: discreteConfig!,
        })),
      };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockCertifiedDiscreteAttributes.length + 1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      eserviceTemplateVersionAttributeGroupNotFound(
        "certified",
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockCertifiedDiscreteAttributes.length + 1
      )
    );
  });

  it("Should throw eserviceTemplateVersionNotFound in case of eservice template version not found", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    const versionId = generateId();
    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedDiscreteAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(versionId),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(versionId)
      )
    );
  });
});
