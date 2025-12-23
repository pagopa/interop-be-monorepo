import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2MEServiceRiskAnalysisAnswers,
} from "../../mockUtils.js";

describe("getEserviceTemplateRiskAnalyses", () => {
  const mockRiskAnalysis1: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;
  const mockRiskAnalysis2: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;
  const mockRiskAnalysis3: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;
  const mockRiskAnalysis4: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;
  const mockRiskAnalysis5: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    getMockedApiEServiceTemplate().riskAnalysis[0]!;
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    riskAnalysis: [
      mockRiskAnalysis1,
      mockRiskAnalysis2,
      mockRiskAnalysis3,
      mockRiskAnalysis4,
      mockRiskAnalysis5,
    ],
  };

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

  const m2mEServiceTemplateRiskAnalysis1 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis1);
  const m2mEServiceTemplateRiskAnalysis2 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis2);
  const m2mEServiceTemplateRiskAnalysis3 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis3);
  const m2mEServiceTemplateRiskAnalysis4 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis4);
  const m2mEServiceTemplateRiskAnalysis5 =
    testToM2MGatewayApiRiskAnalysis(mockRiskAnalysis5);

  const mockGetEserviceTemplate = vi
    .fn()
    .mockResolvedValue(getMockWithMetadata(mockEServiceTemplate));

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEserviceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEserviceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mRiskAnalysesResponse: m2mGatewayApiV3.EServiceTemplateRiskAnalyses =
    {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: mockEServiceTemplate.riskAnalysis.length,
      },
      results: [
        m2mEServiceTemplateRiskAnalysis1,
        m2mEServiceTemplateRiskAnalysis2,
        m2mEServiceTemplateRiskAnalysis3,
        m2mEServiceTemplateRiskAnalysis4,
        m2mEServiceTemplateRiskAnalysis5,
      ],
    };

    const result =
      await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
        unsafeBrandId(mockEServiceTemplate.id),
        {
          offset: 0,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(m2mRiskAnalysesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const response1: m2mGatewayApiV3.EServiceTemplateRiskAnalyses = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: mockEServiceTemplate.riskAnalysis.length,
      },
      results: [
        m2mEServiceTemplateRiskAnalysis1,
        m2mEServiceTemplateRiskAnalysis2,
      ],
    };

    const result =
      await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
        unsafeBrandId(mockEServiceTemplate.id),
        {
          offset: 0,
          limit: 2,
        },
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(response1);

    const response2: m2mGatewayApiV3.EServiceTemplateRiskAnalyses = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: mockEServiceTemplate.riskAnalysis.length,
      },
      results: [
        m2mEServiceTemplateRiskAnalysis3,
        m2mEServiceTemplateRiskAnalysis4,
      ],
    };

    const result2 =
      await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
        unsafeBrandId(mockEServiceTemplate.id),
        {
          offset: 2,
          limit: 2,
        },
        getMockM2MAdminAppContext()
      );

    expect(result2).toEqual(response2);

    const response3: m2mGatewayApiV3.EServiceTemplateRiskAnalyses = {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: mockEServiceTemplate.riskAnalysis.length,
      },
      results: [m2mEServiceTemplateRiskAnalysis5],
    };

    const result3 =
      await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
        unsafeBrandId(mockEServiceTemplate.id),
        {
          offset: 4,
          limit: 2,
        },
        getMockM2MAdminAppContext()
      );

    expect(result3).toEqual(response3);
  });
});
