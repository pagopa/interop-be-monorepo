import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockValidEServiceTemplateRiskAnalysis,
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
import { config } from "../../../src/config/config.js";
import {
  eserviceTemplateRiskAnalysisNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  buildEserviceTemplateRiskAnalysisSeed,
  getMockM2MAdminAppContext,
  testToM2MEServiceRiskAnalysisAnswers,
} from "../../mockUtils.js";

describe("createEServiceTemplateRiskAnalysis", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    mockEServiceTemplate.riskAnalysis[0]!;

  const mockRiskAnalysisSeed: m2mGatewayApiV3.EServiceTemplateRiskAnalysisSeed =
    buildEserviceTemplateRiskAnalysisSeed(
      getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA)
    );

  const mockCreateResponseData: eserviceTemplateApi.CreatedEServiceTemplateRiskAnalysis =
    {
      eserviceTemplate: mockEServiceTemplate,
      createdRiskAnalysisId: mockRiskAnalysis.id,
    };
  const mockCreateRiskAnalysis = vi.fn().mockResolvedValue({
    data: mockCreateResponseData,
    metadata: { version: 0 },
  });
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(getMockWithMetadata(mockEServiceTemplate), 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
    createEServiceTemplateRiskAnalysis: mockCreateRiskAnalysis,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockCreateRiskAnalysis.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result =
      await eserviceTemplateService.createEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      );

    const expectedRiskAnalysis: m2mGatewayApiV3.EServiceTemplateRiskAnalysis = {
      id: mockRiskAnalysis.id,
      name: mockRiskAnalysis.name,
      createdAt: mockRiskAnalysis.createdAt,
      riskAnalysisForm: {
        id: mockRiskAnalysis.riskAnalysisForm.id,
        version: mockRiskAnalysis.riskAnalysisForm.version,
        answers: testToM2MEServiceRiskAnalysisAnswers(
          mockRiskAnalysis.riskAnalysisForm
        ),
      },
      tenantKind: mockRiskAnalysis.tenantKind,
    };
    expect(result).toStrictEqual(expectedRiskAnalysis);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .createEServiceTemplateRiskAnalysis,
      body: mockRiskAnalysisSeed,
      params: { templateId: mockEServiceTemplate.id },
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

  it("Should throw missingMetadata in case the eserviceTemplate returned by the creation POST call has no metadata", async () => {
    mockCreateRiskAnalysis.mockResolvedValueOnce({
      data: mockCreateResponseData,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.createEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        mockRiskAnalysisSeed,
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
      eserviceTemplateService.createEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw eserviceTemplateRiskAnalysisNotFound in case of risk analysis missing in eserviceTemplate returned by the process", async () => {
    const eserviceWithoutRiskAnalysis = getMockWithMetadata({
      ...mockEServiceTemplate,
      riskAnalysis: [],
    });
    mockCreateRiskAnalysis.mockResolvedValueOnce({
      data: {
        eserviceTemplate: eserviceWithoutRiskAnalysis.data,
        createdRiskAnalysisId: mockRiskAnalysis.id,
      } satisfies eserviceTemplateApi.CreatedEServiceTemplateRiskAnalysis,
      metadata: { version: 0 },
    });

    await expect(
      eserviceTemplateService.createEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateRiskAnalysisNotFound(
        unsafeBrandId(mockEServiceTemplate.id),
        mockRiskAnalysis.id
      )
    );
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEServiceTemplate),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.createEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        mockRiskAnalysisSeed,
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
