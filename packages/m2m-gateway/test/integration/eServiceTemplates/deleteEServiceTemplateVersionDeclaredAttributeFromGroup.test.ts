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
  eserviceTemplateVersionAttributeNotFoundInGroup,
  eserviceTemplateVersionNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEServiceTemplateVersionDeclaredAttributeFromGroup", () => {
  const mockAttribute = getMockedApiEServiceAttribute();
  const mockVerifiedAttributes = [
    [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
    [getMockedApiEServiceAttribute(), mockAttribute],
    [mockAttribute],
    [
      getMockedApiEServiceAttribute(),
      getMockedApiEServiceAttribute(),
      getMockedApiEServiceAttribute(),
    ],
  ];
  const mockVersion = getMockedApiEserviceTemplateVersion({
    attributes: {
      certified: [],
      declared: mockVerifiedAttributes,
      verified: [],
    },
  });
  const mockEServiceTemplate = getMockedApiEServiceTemplate({
    versions: [mockVersion],
  });

  const mockGetEServiceTemplateResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockGetEServiceTemplateResponse, 2)
  );

  const mockPatchUpdateTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockGetEServiceTemplateResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    patchUpdateDraftTemplateVersion: mockPatchUpdateTemplateVersion,
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdateTemplateVersion.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    const groupIndex = 1;

    await eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
      unsafeBrandId(mockEServiceTemplate.id),
      unsafeBrandId(mockVersion.id),
      groupIndex,
      unsafeBrandId(mockAttribute.id),
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
          certified: [],
          declared: mockVerifiedAttributes.map((group, index) => {
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
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should delete the whole group if the last attribute is removed", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockGetEServiceTemplateResponse
    );

    const groupIndex = 2;

    await eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
      unsafeBrandId(mockEServiceTemplate.id),
      unsafeBrandId(mockVersion.id),
      groupIndex,
      unsafeBrandId(mockAttribute.id),
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
          certified: [],
          declared: mockVerifiedAttributes.filter(
            (_, index) => index !== groupIndex
          ),
          verified: [],
        },
      },
    });
  });

  it("Should throw missingMetadata in case the eservice template returned by the update PATCH call has no metadata", async () => {
    mockPatchUpdateTemplateVersion.mockResolvedValueOnce({
      ...mockGetEServiceTemplateResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        unsafeBrandId(mockAttribute.id),
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

    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        unsafeBrandId(mockAttribute.id),
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

    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
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
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });

  it("Should throw eserviceTemplateVersionAttributeGroupNotFound in case of missing group for the specified group index", async () => {
    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockVerifiedAttributes.length + 1,
        unsafeBrandId(mockAttribute.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionAttributeGroupNotFound(
        "declared",
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockVerifiedAttributes.length + 1
      )
    );
  });

  it("Should throw eserviceTemplateVersionAttributeNotFoundInGroup in case of attribute not found", async () => {
    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        1,
        unsafeBrandId(generateId()),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionAttributeNotFoundInGroup(
        unsafeBrandId(mockVersion.id),
        1
      )
    );
  });

  it("Should throw eserviceTemplateVersionNotFound in case of eservice template version not found", async () => {
    const versionId = generateId();
    await expect(
      eserviceTemplateService.deleteEServiceTemplateVersionDeclaredAttributeFromGroup(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(versionId),
        1,
        unsafeBrandId(mockAttribute.id),
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
