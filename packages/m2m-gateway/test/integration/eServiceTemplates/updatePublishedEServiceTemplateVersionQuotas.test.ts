import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
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
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("updatePublishedEServiceTemplateVersionQuotas", () => {
  const mockVersion: eserviceTemplateApi.EServiceTemplateVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    state: "PUBLISHED",
    voucherLifespan: 0,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
  };

  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate({
      versions: [mockVersion, getMockedApiEserviceTemplateVersion()],
    });

  const mockEServiceTemplateProcessResponse =
    getMockWithMetadata(mockEServiceTemplate);

  const mockQuotasSeed: m2mGatewayApi.EServiceTemplateVersionQuotasUpdateSeed =
    {
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
    };

  const mockPatchUpdateQuotas = vi
    .fn()
    .mockResolvedValue(mockEServiceTemplateProcessResponse);

  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockEServiceTemplateProcessResponse, 1)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
    updateTemplateVersionQuotas: mockPatchUpdateQuotas,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockPatchUpdateQuotas.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result =
      await eserviceTemplateService.updatePublishedEServiceTemplateVersionQuotas(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockQuotasSeed,
        getMockM2MAdminAppContext()
      );

    const expectedM2MEServiceTemplateVersion: m2mGatewayApi.EServiceTemplateVersion =
      toM2MGatewayEServiceTemplateVersion(mockVersion);

    expect(result).toEqual(expectedM2MEServiceTemplateVersion);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .updateTemplateVersionQuotas,
      params: {
        templateId: mockEServiceTemplate.id,
        templateVersionId: mockVersion.id,
      },
      body: mockQuotasSeed,
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

  it("Should throw missingMetadata in case the eservice template version returned by the PATCH call has no metadata", async () => {
    mockPatchUpdateQuotas.mockResolvedValueOnce({
      ...mockEServiceTemplateProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.updatePublishedEServiceTemplateVersionQuotas(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockQuotasSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice template version returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate
      .mockResolvedValueOnce({
        ...mockEServiceTemplateProcessResponse,
        metadata: undefined,
      })
      .mockResolvedValueOnce({
        ...mockEServiceTemplateProcessResponse,
        metadata: undefined,
      });

    await expect(
      eserviceTemplateService.updatePublishedEServiceTemplateVersionQuotas(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockQuotasSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        mockEServiceTemplateProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );
    await expect(
      eserviceTemplateService.updatePublishedEServiceTemplateVersionQuotas(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockQuotasSeed,
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
