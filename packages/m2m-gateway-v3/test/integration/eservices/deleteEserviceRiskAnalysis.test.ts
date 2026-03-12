import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteEserviceRiskAnalysis", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockRiskAnalysis: catalogApi.EServiceRiskAnalysis =
    mockEService.riskAnalysis[0]!;

  const mockEServiceResponse = getMockWithMetadata(mockEService);
  const mockGetEService = vi.fn(mockPollingResponse(mockEServiceResponse, 2));

  const mockDeleteRiskAnalysis = vi.fn().mockResolvedValue({
    metadata: mockEServiceResponse.metadata,
  });

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    deleteRiskAnalysis: mockDeleteRiskAnalysis,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEService.mockClear();
    mockDeleteRiskAnalysis.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await eserviceService.deleteEServiceRiskAnalysis(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockRiskAnalysis.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.deleteRiskAnalysis,
      params: {
        eServiceId: mockEService.id,
        riskAnalysisId: mockRiskAnalysis.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the DELETE call has no metadata", async () => {
    mockDeleteRiskAnalysis.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.deleteEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockRiskAnalysis.id),
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
      eserviceService.deleteEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockRiskAnalysis.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEService),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.deleteEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockRiskAnalysis.id),
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
