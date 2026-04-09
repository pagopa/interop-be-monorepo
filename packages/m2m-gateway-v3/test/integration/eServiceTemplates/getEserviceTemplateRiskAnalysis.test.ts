import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  RiskAnalysisId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
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
import { eserviceTemplateRiskAnalysisNotFound } from "../../../src/model/errors.js";

describe("getEserviceTemplateRiskAnalysis", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis =
    mockEServiceTemplate.riskAnalysis[0]!;

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

    const result =
      await eserviceTemplateService.getEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        unsafeBrandId(mockRiskAnalysis.id),
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual(expectedRiskAnalysis);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
  });

  it("Should throw eserviceTemplateRiskAnalysisNotFound in case the returned eservice template has no risk analysis with the given id", async () => {
    const nonExistingRiskAnalysisId = generateId<RiskAnalysisId>();
    await expect(
      eserviceTemplateService.getEServiceTemplateRiskAnalysis(
        unsafeBrandId(mockEServiceTemplate.id),
        nonExistingRiskAnalysisId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateRiskAnalysisNotFound(
        mockEServiceTemplate.id,
        nonExistingRiskAnalysisId
      )
    );
  });
});
