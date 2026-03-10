import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEserviceTemplateRiskAnalysis", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    mockEServiceTemplate.riskAnalysis[0]!;

  const mockEServiceTemplateResponse =
    getMockWithMetadata(mockEServiceTemplate);
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockEServiceTemplateResponse, 2)
  );

  const mockDeleteRiskAnalysis = vi.fn().mockResolvedValue({
    metadata: mockEServiceTemplateResponse.metadata,
  });

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
    deleteEServiceTemplateRiskAnalysis: mockDeleteRiskAnalysis,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEServiceTemplate.mockClear();
    mockDeleteRiskAnalysis.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await eserviceTemplateService.deleteEServiceTemplateRiskAnalysis(
      unsafeBrandId(mockEServiceTemplate.id),
      unsafeBrandId(mockRiskAnalysis.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .deleteEServiceTemplateRiskAnalysis,
      params: {
        templateId: mockEServiceTemplate.id,
        riskAnalysisId: mockRiskAnalysis.id,
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
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eserviceTemplate returned by the DELETE call has no metadata", async () => {
    mockDeleteRiskAnalysis.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.deleteEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockRiskAnalysis.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eserviceTemplate returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce({
      data: mockEServiceTemplate,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.deleteEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockRiskAnalysis.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEServiceTemplate),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.deleteEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockRiskAnalysis.id),
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
