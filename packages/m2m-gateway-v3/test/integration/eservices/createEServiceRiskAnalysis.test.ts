import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockValidRiskAnalysis,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceRiskAnalysisNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  buildRiskAnalysisSeed,
  getMockM2MAdminAppContext,
  testToM2MEServiceRiskAnalysisAnswers,
} from "../../mockUtils.js";

describe("createEServiceRiskAnalysis", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockRiskAnalysis: catalogApi.EServiceRiskAnalysis =
    mockEService.riskAnalysis[0]!;

  const mockRiskAnalysisSeed: m2mGatewayApiV3.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA));

  const mockCreateResponseData: catalogApi.CreatedEServiceRiskAnalysis = {
    eservice: mockEService,
    createdRiskAnalysisId: mockRiskAnalysis.id,
  };
  const mockCreateRiskAnalysis = vi.fn().mockResolvedValue({
    data: mockCreateResponseData,
    metadata: { version: 0 },
  });
  const mockGetEService = vi.fn(
    mockPollingResponse(getMockWithMetadata(mockEService), 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    createRiskAnalysis: mockCreateRiskAnalysis,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockCreateRiskAnalysis.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceService.createEServiceRiskAnalysis(
      unsafeBrandId(mockEService.id),
      mockRiskAnalysisSeed,
      getMockM2MAdminAppContext()
    );

    const expectedRiskAnalysis: m2mGatewayApiV3.EServiceRiskAnalysis = {
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
    };
    expect(result).toEqual(expectedRiskAnalysis);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.createRiskAnalysis,
      body: mockRiskAnalysisSeed,
      params: { eServiceId: mockEService.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the creation POST call has no metadata", async () => {
    mockCreateRiskAnalysis.mockResolvedValueOnce({
      data: mockCreateResponseData,
      metadata: undefined,
    });

    await expect(
      eserviceService.createEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      data: mockEService,
      metadata: undefined,
    });

    await expect(
      eserviceService.createEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw eserviceRiskAnalysisNotFound in case of risk analysis missing in eservice returned by the process", async () => {
    const eserviceWithoutRiskAnalysis = getMockWithMetadata({
      ...mockEService,
      riskAnalysis: [],
    });
    mockCreateRiskAnalysis.mockResolvedValueOnce({
      data: {
        eservice: eserviceWithoutRiskAnalysis.data,
        createdRiskAnalysisId: mockRiskAnalysis.id,
      } satisfies catalogApi.CreatedEServiceRiskAnalysis,
      metadata: { version: 0 },
    });

    await expect(
      eserviceService.createEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceRiskAnalysisNotFound(
        unsafeBrandId(mockEService.id),
        mockRiskAnalysis.id
      )
    );
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEService),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.createEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        mockRiskAnalysisSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
