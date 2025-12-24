import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiRiskAnalysisTemplateAnswers } from "../../../src/api/riskAnalysisFormTemplateApiConverter.js";

describe("getPurposeTemplateRiskAnalysis", () => {
  const mockApiPurposeTemplateResponse = getMockWithMetadata(
    getMockedApiPurposeTemplate()
  );

  const mockGetPurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockApiPurposeTemplateResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const mockRiskAnalysisFormTemplate =
      mockApiPurposeTemplateResponse.data.purposeRiskAnalysisForm!;
    const expectedM2MRiskAnalysisFormTemplate: m2mGatewayApiV3.RiskAnalysisFormTemplate =
      {
        version: mockRiskAnalysisFormTemplate.version,
        answers: toM2MGatewayApiRiskAnalysisTemplateAnswers(
          mockRiskAnalysisFormTemplate.answers
        ),
      };

    const result = await purposeTemplateService.getPurposeTemplateRiskAnalysis(
      unsafeBrandId(mockApiPurposeTemplateResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MRiskAnalysisFormTemplate);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: {
        id: mockApiPurposeTemplateResponse.data.id,
      },
    });
  });
});
