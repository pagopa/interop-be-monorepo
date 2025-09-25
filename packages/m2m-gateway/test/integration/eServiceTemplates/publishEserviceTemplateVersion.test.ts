import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceTemplateVersionNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("publishEServiceTemplateVersion", () => {
  const mockApiTemplateVersion: eserviceTemplateApi.EServiceTemplateVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    state: "PUBLISHED",
  };

  const mockApiTemplate = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [mockApiTemplateVersion],
    })
  );

  const mockM2MTemplateVersionResponse = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion
  );

  const mockPublishTemplateVersion = vi.fn().mockResolvedValue(mockApiTemplate);
  const mockGetEServiceTemplateById = vi.fn(
    mockPollingResponse(mockApiTemplate, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplateById,
    publishTemplateVersion: mockPublishTemplateVersion,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPublishTemplateVersion.mockClear();
    mockGetEServiceTemplateById.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceTemplateService.publishEServiceTemplateVersion(
      unsafeBrandId(mockApiTemplate.data.id),
      unsafeBrandId(mockApiTemplateVersion.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockM2MTemplateVersionResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .publishTemplateVersion,
      params: {
        templateId: mockApiTemplate.data.id,
        templateVersionId: mockApiTemplateVersion.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockApiTemplate.data.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw eserviceTemplateVersionNotFound in case of version missing in template returned by the process", async () => {
    const templateWithoutVersion: eserviceTemplateApi.EServiceTemplate = {
      ...mockApiTemplate.data,
      versions: [],
    };

    mockPublishTemplateVersion.mockResolvedValue({
      data: templateWithoutVersion,
      metadata: { version: 0 },
    });

    mockGetEServiceTemplateById.mockResolvedValue({
      data: templateWithoutVersion,
      metadata: { version: 0 },
    });

    await expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id)
      )
    );
  });

  it("Should throw missingMetadata in case the template returned by the publish call has no metadata", async () => {
    mockPublishTemplateVersion.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplateById.mockResolvedValueOnce({
      data: mockApiTemplate.data,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplateById.mockImplementation(
      mockPollingResponse(mockApiTemplate, config.defaultPollingMaxRetries + 1)
    );

    await expect(
      eserviceTemplateService.publishEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEServiceTemplateById).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
