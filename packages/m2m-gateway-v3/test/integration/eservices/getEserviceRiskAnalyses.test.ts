import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2MEServiceRiskAnalysisAnswers,
} from "../../mockUtils.js";

describe("getEserviceRiskAnalyses", () => {
  const eserviceId = generateId();

  const mockRiskAnalysis1: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;
  const mockRiskAnalysis2: catalogApi.EServiceRiskAnalysis =
    getMockedApiEservice().riskAnalysis[0]!;

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

  // Pagination is now performed by catalog-process: the gateway only forwards
  // the query params and maps the paginated results.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockRiskAnalysis1, mockRiskAnalysis2],
    totalCount: 5,
  });

  const mockGetEServiceRiskAnalyses = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceRiskAnalyses: mockGetEServiceRiskAnalyses,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetEServiceRiskAnalyses.mockClear();
  });

  it("Should delegate pagination to catalog-process and map the results", async () => {
    const expected: m2mGatewayApiV3.EServiceRiskAnalyses = {
      results: [
        testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis1),
        testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis2),
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 5,
      },
    };

    const result = await eserviceService.getEServiceRiskAnalyses(
      unsafeBrandId(eserviceId),
      { offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.catalogProcessClient.getEServiceRiskAnalyses,
      params: { eServiceId: eserviceId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should forward the pagination params to the process", async () => {
    await eserviceService.getEServiceRiskAnalyses(
      unsafeBrandId(eserviceId),
      { offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.catalogProcessClient.getEServiceRiskAnalyses,
      params: { eServiceId: eserviceId },
      queries: { offset: 2, limit: 2 },
    });
  });
});
