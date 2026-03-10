import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  RiskAnalysisId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2MEServiceRiskAnalysisAnswers,
} from "../../mockUtils.js";
import { eserviceRiskAnalysisNotFound } from "../../../src/model/errors.js";

describe("getEserviceRiskAnalysis", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockRiskAnalysis: catalogApi.EServiceRiskAnalysis =
    mockEService.riskAnalysis[0]!;

  const mockGetEservice = vi
    .fn()
    .mockResolvedValue(getMockWithMetadata(mockEService));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedRiskAnalysis: m2mGatewayApi.EServiceRiskAnalysis = {
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

    const result = await eserviceService.getEServiceRiskAnalysis(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockRiskAnalysis.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedRiskAnalysis);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
  });

  it("Should throw eserviceRiskAnalysisNotFound in case the returned eservice has no risk analysis with the given id", async () => {
    const nonExistingRiskAnalysisId = generateId<RiskAnalysisId>();
    await expect(
      eserviceService.getEServiceRiskAnalysis(
        unsafeBrandId(mockEService.id),
        nonExistingRiskAnalysisId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceRiskAnalysisNotFound(mockEService.id, nonExistingRiskAnalysisId)
    );
  });
});
