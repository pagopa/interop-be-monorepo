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

describe("suspendEServiceTemplateVersion", () => {
  const mockApiTemplateVersion: eserviceTemplateApi.EServiceTemplateVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    state: "SUSPENDED",
  };

  const mockApiTemplate = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [mockApiTemplateVersion],
    })
  );

  const mockM2MTemplateVersionResponse = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion
  );

  const mockSuspendTemplateVersion = vi.fn().mockResolvedValue(mockApiTemplate);
  const mockGetEServiceTemplateById = vi.fn(
    mockPollingResponse(mockApiTemplate, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplateById,
    suspendTemplateVersion: mockSuspendTemplateVersion,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockSuspendTemplateVersion.mockClear();
    mockGetEServiceTemplateById.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceTemplateService.suspendEServiceTemplateVersion(
      unsafeBrandId(mockApiTemplate.data.id),
      unsafeBrandId(mockApiTemplateVersion.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(mockM2MTemplateVersionResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .suspendTemplateVersion,
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

    mockSuspendTemplateVersion.mockResolvedValue({
      data: templateWithoutVersion,
      metadata: { version: 0 },
    });

    mockGetEServiceTemplateById.mockResolvedValue({
      data: templateWithoutVersion,
      metadata: { version: 0 },
    });

    await expect(
      eserviceTemplateService.suspendEServiceTemplateVersion(
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

  it("Should throw missingMetadata in case the template returned by the suspend call has no metadata", async () => {
    mockSuspendTemplateVersion.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.suspendEServiceTemplateVersion(
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
      eserviceTemplateService.suspendEServiceTemplateVersion(
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
      eserviceTemplateService.suspendEServiceTemplateVersion(
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
