import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2MEServiceRiskAnalysisAnswers,
} from "../../mockUtils.js";

describe("getEserviceTemplateRiskAnalyses", () => {
  const templateId = generateId();

  const mockRiskAnalysis1: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;
  const mockRiskAnalysis2: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;

  const testToM2MGatewayApiRiskAnalysis = (
    mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis
  ): m2mGatewayApiV3.EServiceTemplateRiskAnalysis => ({
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
  });

  // Pagination is now performed by eservice-template-process.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockRiskAnalysis1, mockRiskAnalysis2],
    totalCount: 5,
  });

  const mockGetEServiceTemplateRiskAnalyses = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateRiskAnalyses: mockGetEServiceTemplateRiskAnalyses,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetEServiceTemplateRiskAnalyses.mockClear();
  });

  it("Should delegate pagination to eservice-template-process and map the results", async () => {
    const expected: m2mGatewayApiV3.EServiceTemplateRiskAnalyses = {
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

    const result =
      await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
        unsafeBrandId(templateId),
        { offset: 0, limit: 10 },
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateRiskAnalyses,
      params: { templateId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should forward the pagination params to the process", async () => {
    await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
      unsafeBrandId(templateId),
      { offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateRiskAnalyses,
      params: { templateId },
      queries: { offset: 2, limit: 2 },
    });
  });
});
