import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
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

describe("getEserviceRiskAnalyses", () => {
  const mockRiskAnalysis1: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;
  const mockRiskAnalysis2: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;
  const mockRiskAnalysis3: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;
  const mockRiskAnalysis4: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;
  const mockRiskAnalysis5: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;
  const mockEService: catalogApi.EService = {
    ...getMockedApiEservice(),
    riskAnalysis: [
      mockRiskAnalysis1,
      mockRiskAnalysis2,
      mockRiskAnalysis3,
      mockRiskAnalysis4,
      mockRiskAnalysis5,
    ],
  };

  const testToM2MGatewayApiRiskAnalysis = (
    mockRiskAnalysis: catalogApi.EServiceRiskAnalysis
  ): m2mGatewayApiV3.EServiceRiskAnalysis => ({
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
  });

  const m2mEServiceRiskAnalysis1 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis1);
  const m2mEServiceRiskAnalysis2 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis2);
  const m2mEServiceRiskAnalysis3 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis3);
  const m2mEServiceRiskAnalysis4 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis4);
  const m2mEServiceRiskAnalysis5 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis5);

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
    const m2mRiskAnalysesResponse: m2mGatewayApiV3.EServiceRiskAnalyses = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: mockEService.riskAnalysis.length,
      },
      results: [
        m2mEServiceRiskAnalysis1,
        m2mEServiceRiskAnalysis2,
        m2mEServiceRiskAnalysis3,
        m2mEServiceRiskAnalysis4,
        m2mEServiceRiskAnalysis5,
      ],
    };

    const result = await eserviceService.getEServiceRiskAnalyses(
      unsafeBrandId(mockEService.id),
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mRiskAnalysesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const response1: m2mGatewayApiV3.EServiceRiskAnalyses = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: mockEService.riskAnalysis.length,
      },
      results: [m2mEServiceRiskAnalysis1, m2mEServiceRiskAnalysis2],
    };

    const result = await eserviceService.getEServiceRiskAnalyses(
      unsafeBrandId(mockEService.id),
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(response1);

    const response2: m2mGatewayApiV3.EServiceRiskAnalyses = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: mockEService.riskAnalysis.length,
      },
      results: [m2mEServiceRiskAnalysis3, m2mEServiceRiskAnalysis4],
    };

    const result2 = await eserviceService.getEServiceRiskAnalyses(
      unsafeBrandId(mockEService.id),
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result2).toEqual(response2);

    const response3: m2mGatewayApiV3.EServiceRiskAnalyses = {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: mockEService.riskAnalysis.length,
      },
      results: [m2mEServiceRiskAnalysis5],
    };

    const result3 = await eserviceService.getEServiceRiskAnalyses(
      unsafeBrandId(mockEService.id),
      {
        offset: 4,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );

    expect(result3).toEqual(response3);
  });
});
