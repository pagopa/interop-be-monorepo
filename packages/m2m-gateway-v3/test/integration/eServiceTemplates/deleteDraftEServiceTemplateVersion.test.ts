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
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  eserviceTemplateService,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import {
  cannotDeleteLastEServiceTemplateVersion,
  missingMetadata,
} from "../../../src/model/errors.js";

describe("deleteDraftEServiceTemplateVersion", () => {
  const mockApiEserviceTemplateVersion1 = getMockedApiEserviceTemplateVersion();
  const mockApiEserviceTemplateVersion2 = getMockedApiEserviceTemplateVersion();
  const mockApiEServiceTemplate = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [
        mockApiEserviceTemplateVersion1,
        mockApiEserviceTemplateVersion2,
      ],
    })
  );

  const mockDeleteVersion = vi.fn().mockResolvedValue(mockApiEServiceTemplate);

  const pollingAttempts = 2;
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockApiEServiceTemplate, pollingAttempts)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    deleteDraftTemplateVersion: mockDeleteVersion,
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockDeleteVersion.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(mockApiEServiceTemplate);

    await eserviceTemplateService.deleteDraftEServiceTemplateVersion(
      unsafeBrandId(mockApiEServiceTemplate.data.id),
      unsafeBrandId(mockApiEserviceTemplateVersion1.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .deleteDraftTemplateVersion,
      params: {
        templateId: mockApiEServiceTemplate.data.id,
        templateVersionId: mockApiEserviceTemplateVersion1.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: mockApiEServiceTemplate.data.id,
      },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(pollingAttempts + 1);
  });

  it("Should throw cannotDeleteLastEServiceTemplateVersion when trying to delete the last version", async () => {
    const mockApiEServiceTemplateWithOneVersion = getMockWithMetadata(
      getMockedApiEServiceTemplate({
        versions: [mockApiEserviceTemplateVersion1],
      })
    );

    mockGetEServiceTemplate.mockResolvedValueOnce(
      mockApiEServiceTemplateWithOneVersion
    );

    await expect(
      eserviceTemplateService.deleteDraftEServiceTemplateVersion(
        unsafeBrandId(mockApiEServiceTemplateWithOneVersion.data.id),
        unsafeBrandId(mockApiEserviceTemplateVersion1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      cannotDeleteLastEServiceTemplateVersion(
        unsafeBrandId(mockApiEServiceTemplateWithOneVersion.data.id),
        unsafeBrandId(mockApiEserviceTemplateVersion1.id)
      )
    );
  });

  it("Should throw missingMetadata in case the eservice template returned by the DELETE call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce(mockApiEServiceTemplate);
    mockDeleteVersion.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.deleteDraftEServiceTemplateVersion(
        unsafeBrandId(mockApiEServiceTemplate.data.id),
        unsafeBrandId(mockApiEserviceTemplateVersion1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate
      .mockResolvedValueOnce(mockApiEServiceTemplate)
      .mockResolvedValueOnce({
        data: mockApiEServiceTemplate.data,
        metadata: undefined,
      });

    await expect(
      eserviceTemplateService.deleteDraftEServiceTemplateVersion(
        unsafeBrandId(mockApiEServiceTemplate.data.id),
        unsafeBrandId(mockApiEserviceTemplateVersion1.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate
      .mockResolvedValueOnce(mockApiEServiceTemplate)
      .mockImplementation(
        mockPollingResponse(
          mockApiEServiceTemplate,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      eserviceTemplateService.deleteDraftEServiceTemplateVersion(
        unsafeBrandId(mockApiEServiceTemplate.data.id),
        unsafeBrandId(mockApiEserviceTemplateVersion1.id),
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
});
