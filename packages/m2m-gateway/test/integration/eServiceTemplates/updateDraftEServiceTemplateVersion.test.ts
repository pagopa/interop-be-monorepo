import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateVersionId,
  generateId,
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
  expectApiClientGetToHaveBeenNthCalledWith,
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

describe("updateDraftEserviceTemplateVersion", () => {
  const mockTemplateVersion = getMockedApiEserviceTemplateVersion();
  const mockEServiceTemplate = getMockedApiEServiceTemplate({
    versions: [mockTemplateVersion, getMockedApiEserviceTemplateVersion()],
  });
  const mockEServiceTemplateProcessGetResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const versionSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed =
  {
    description: "Test Template Version",
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockPatchUpdateTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockEServiceTemplateProcessGetResponse);
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockEServiceTemplateProcessGetResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
    patchUpdateDraftTemplateVersion: mockPatchUpdateTemplateVersion,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdateTemplateVersion.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result =
      await eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        versionSeed,
        getMockM2MAdminAppContext()
      );

    const expectedM2MTemplateVersion = {
      id: mockTemplateVersion.id,
      state: mockTemplateVersion.state,
      version: mockTemplateVersion.version,
      voucherLifespan: mockTemplateVersion.voucherLifespan,
      agreementApprovalPolicy: mockTemplateVersion.agreementApprovalPolicy,
      dailyCallsPerConsumer: mockTemplateVersion.dailyCallsPerConsumer,
      dailyCallsTotal: mockTemplateVersion.dailyCallsTotal,
      deprecatedAt: mockTemplateVersion.deprecatedAt,
      description: mockTemplateVersion.description,
      publishedAt: mockTemplateVersion.publishedAt,
      suspendedAt: mockTemplateVersion.suspendedAt,
    };

    expect(result).toStrictEqual(expectedM2MTemplateVersion);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .patchUpdateDraftTemplateVersion,
      params: {
        templateId: mockEServiceTemplate.id,
        templateVersionId: mockTemplateVersion.id,
      },
      body: { ...versionSeed, attributes: undefined },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw eserviceTemplateVersionNotFound in case the returned template has no version with the given id", async () => {
    const nonExistingVersionId = generateId<EServiceTemplateVersionId>();
    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockEServiceTemplate.id),
        nonExistingVersionId,
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockEServiceTemplate.id),
        nonExistingVersionId
      )
    );
  });

  it("Should throw missingMetadata in case the template returned by the PATCH call has no metadata", async () => {
    mockPatchUpdateTemplateVersion.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the template returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        mockEServiceTemplateProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
