import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
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

describe("updateDraftEServiceTemplateVersion", () => {
  const mockTemplateVersion = getMockedApiEserviceTemplateVersion();
  const mockTemplate = getMockedApiEServiceTemplate({
    versions: [mockTemplateVersion, getMockedApiEserviceTemplateVersion()],
  });
  const mockTemplateProcessGetResponse = getMockWithMetadata(mockTemplate);

  const templateVersionSeed: m2mGatewayApi.EServiceTemplateVersionDraftUpdateSeed =
    {
      description: "Test Template Version",
      voucherLifespan: 100,
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 10,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockPatchUpdateTemplateVersion = vi
    .fn()
    .mockResolvedValue(mockTemplateProcessGetResponse);
  const mockGetTemplate = vi.fn(
    mockPollingResponse(mockTemplateProcessGetResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
    patchUpdateDraftTemplateVersion: mockPatchUpdateTemplateVersion,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdateTemplateVersion.mockClear();
    mockGetTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result =
      await eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        templateVersionSeed,
        getMockM2MAdminAppContext()
      );

    const expectedM2MTemplateVersion: m2mGatewayApi.EServiceTemplateVersion = {
      id: mockTemplateVersion.id,
      version: mockTemplateVersion.version,
      description: mockTemplateVersion.description,
      voucherLifespan: mockTemplateVersion.voucherLifespan,
      dailyCallsPerConsumer: mockTemplateVersion.dailyCallsPerConsumer,
      dailyCallsTotal: mockTemplateVersion.dailyCallsTotal,
      state: mockTemplateVersion.state,
      agreementApprovalPolicy: mockTemplateVersion.agreementApprovalPolicy,
      publishedAt: mockTemplateVersion.publishedAt,
      suspendedAt: mockTemplateVersion.suspendedAt,
      deprecatedAt: mockTemplateVersion.deprecatedAt,
    };

    expect(result).toEqual(expectedM2MTemplateVersion);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .patchUpdateDraftTemplateVersion,
      params: {
        templateId: mockTemplate.id,
        templateVersionId: mockTemplateVersion.id,
      },
      body: {
        ...templateVersionSeed,
        attributes: undefined,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockTemplate.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockTemplate.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw eserviceTemplateVersionNotFound in case the returned template has no version with the given id", async () => {
    const nonExistingVersionId = generateId<EServiceTemplateVersionId>();
    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockTemplate.id),
        nonExistingVersionId,
        templateVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockTemplate.id),
        nonExistingVersionId
      )
    );
  });

  it("Should throw missingMetadata in case the template returned by the PATCH call has no metadata", async () => {
    mockPatchUpdateTemplateVersion.mockResolvedValueOnce({
      ...mockTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        templateVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the template returned by the polling GET call has no metadata", async () => {
    mockGetTemplate.mockResolvedValueOnce({
      ...mockTemplateProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        templateVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetTemplate.mockImplementation(
      mockPollingResponse(
        mockTemplateProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.updateDraftEServiceTemplateVersion(
        unsafeBrandId(mockTemplate.id),
        unsafeBrandId(mockTemplateVersion.id),
        templateVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
