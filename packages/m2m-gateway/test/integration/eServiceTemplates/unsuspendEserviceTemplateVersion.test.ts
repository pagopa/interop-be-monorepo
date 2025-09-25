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

describe("unsuspendEServiceTemplateVersion", () => {
  const mockApiTemplateVersion: eserviceTemplateApi.EServiceTemplateVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    state: "SUSPENDED",
  };

  const mockApiTemplate = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [mockApiTemplateVersion],
    })
  );

  const mockApiTemplateVersionAfterUnsuspend: eserviceTemplateApi.EServiceTemplateVersion =
    {
      ...mockApiTemplateVersion,
      state: "PUBLISHED",
    };

  const mockApiTemplateAfterUnsuspend = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [mockApiTemplateVersionAfterUnsuspend],
    })
  );

  const mockM2MTemplateVersionResponse = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersionAfterUnsuspend
  );

  const mockActivateTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockApiTemplateAfterUnsuspend);
  const mockGetEServiceTemplateById = vi.fn();

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplateById,
    activateTemplateVersion: mockActivateTemplateVersion,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockActivateTemplateVersion.mockClear();
    mockGetEServiceTemplateById.mockClear();
    mockGetEServiceTemplateById.mockReset();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEServiceTemplateById
      .mockResolvedValueOnce(mockApiTemplate)
      .mockImplementation(
        mockPollingResponse(mockApiTemplateAfterUnsuspend, 2)
      );

    const result =
      await eserviceTemplateService.unsuspendEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(mockM2MTemplateVersionResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .activateTemplateVersion,
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
    ).toHaveBeenCalledTimes(3);
  });

  it("Should throw eserviceTemplateVersionNotFound in case of version missing in template returned by the process", async () => {
    const templateWithoutVersion: eserviceTemplateApi.EServiceTemplate = {
      ...mockApiTemplate.data,
      versions: [],
    };

    mockActivateTemplateVersion.mockResolvedValue({
      data: templateWithoutVersion,
      metadata: { version: 1 },
    });

    mockGetEServiceTemplateById.mockResolvedValue({
      data: templateWithoutVersion,
      metadata: { version: 1 },
    });

    await expect(
      eserviceTemplateService.unsuspendEServiceTemplateVersion(
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
  it("Should throw missingMetadata in case the template returned by the unsuspend call has no metadata", async () => {
    mockGetEServiceTemplateById.mockResolvedValueOnce(mockApiTemplate);

    mockActivateTemplateVersion.mockResolvedValueOnce({
      data: mockApiTemplateAfterUnsuspend.data,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.unsuspendEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplateById
      .mockResolvedValueOnce(mockApiTemplate)
      .mockResolvedValueOnce({
        data: mockApiTemplateAfterUnsuspend.data,
        metadata: undefined,
      });

    mockActivateTemplateVersion.mockResolvedValueOnce(
      mockApiTemplateAfterUnsuspend
    );

    await expect(
      eserviceTemplateService.unsuspendEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        unsafeBrandId(mockApiTemplateVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplateById.mockImplementation(
      mockPollingResponse(
        mockApiTemplateAfterUnsuspend,
        config.defaultPollingMaxRetries + 1
      )
    );

    mockActivateTemplateVersion.mockResolvedValueOnce(
      mockApiTemplateAfterUnsuspend
    );

    await expect(
      eserviceTemplateService.unsuspendEServiceTemplateVersion(
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
