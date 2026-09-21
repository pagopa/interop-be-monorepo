import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiRiskAnalysisTemplateAnswers } from "../../../src/api/riskAnalysisFormTemplateApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

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
    const expectedM2MRiskAnalysisFormTemplate: m2mGatewayApi.RiskAnalysisFormTemplate =
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

    expect(result).toStrictEqual(expectedM2MRiskAnalysisFormTemplate);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: {
        id: mockApiPurposeTemplateResponse.data.id,
      },
    });
  });
});
