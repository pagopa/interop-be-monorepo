import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiEServiceAttribute,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
} from "pagopa-interop-commons-test";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  eserviceTemplateVersionAttributeGroupNotFound,
  eserviceTemplateVersionNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("assignEServiceTemplateVersionCertifiedAttributesToGroup", () => {
  const mockNewAttribute1 = getMockedApiEServiceAttribute();
  const mockNewAttribute2 = getMockedApiEServiceAttribute();
  const mockCertifiedAttributes = [
    [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
    [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
    [getMockedApiEServiceAttribute()],
  ];
  const mockVersion = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Values.DRAFT,
    attributes: {
      certified: mockCertifiedAttributes,
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

  it("Should succeed and perform API clients calls", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(mockGetEServiceTemplateResponse, 2)
    );

    const groupIndex = 1;
    const seed = {
      attributeIds: [mockNewAttribute1.id, mockNewAttribute2.id],
    };

    await eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
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
          certified: mockCertifiedAttributes.map((group, index) => {
            if (index === groupIndex) {
              return [
                ...group,
                ...seed.attributeIds.map((id) => ({
                  id,
                  explicitAttributeVerification: false,
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
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should add attributes to the specified group", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(mockGetEServiceTemplateResponse, 2)
    );

    const groupIndex = 0;
    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
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
          certified: [
            [
              ...mockCertifiedAttributes[0],
              {
                id: mockNewAttribute1.id,
                explicitAttributeVerification: false,
              },
            ],
            mockCertifiedAttributes[1],
            mockCertifiedAttributes[2],
          ],
          declared: [],
          verified: [],
        },
      },
    });
  });

  it("Should throw missingMetadata in case the eservice template returned by the update PATCH call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockPatchUpdateTemplateVersion.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
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

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
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
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });

  it("Should throw eserviceTemplateVersionAttributeGroupNotFound in case of missing group for the specified group index", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    const seed = {
      attributeIds: [mockNewAttribute1.id],
    };

    await expect(
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockCertifiedAttributes.length + 1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionAttributeGroupNotFound(
        "certified",
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockCertifiedAttributes.length + 1
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
      eserviceTemplateService.assignEServiceTemplateVersionCertifiedAttributesToGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(versionId),
        1,
        seed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(versionId)
      )
    );
  });
});
