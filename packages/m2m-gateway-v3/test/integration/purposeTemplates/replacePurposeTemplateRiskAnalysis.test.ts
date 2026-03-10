import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  generateId,
  pollingMaxRetriesExceeded,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestVersionFormRules } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeTemplateService,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2MRiskAnalysisTemplateAnswer,
} from "../../mockUtils.js";

describe("replacePurposeTemplateRiskAnalysis", () => {
  const mockPurposeTemplate = getMockedApiPurposeTemplate();
  const mockValiRiskAnalysisFormTemplate = getMockValidRiskAnalysisFormTemplate(
    tenantKind.PA
  );

  const mockRiskAnalysisFormTemplate = {
    version: mockValiRiskAnalysisFormTemplate.version,
    answers: {
      ...Object.fromEntries(
        mockValiRiskAnalysisFormTemplate.singleAnswers.map(
          ({ key, ...value }) => [
            key,
            {
              ...value,
              values: value.value,
            },
          ]
        )
      ),
      ...Object.fromEntries(
        mockValiRiskAnalysisFormTemplate.multiAnswers.map(
          ({ key, ...values }) => [key, values]
        )
      ),
    },
  };

  const newAnswer = {
    purpose: {
      editable: false,
      values: ["New value"],
      suggestedValues: [],
    },
  };

  const mockRiskAnalysisFormTemplateSeed: m2mGatewayApiV3.RiskAnalysisFormTemplateSeed =
    {
      version: getLatestVersionFormRules(tenantKind.PA)!.version,
      answers: newAnswer,
    };

  const mockVersion = 2;
  const mockPurposeTemplateProcessUpdateResponse = getMockWithMetadata(
    {
      ...mockRiskAnalysisFormTemplate,
      answers: {
        purpose: {
          ...newAnswer.purpose,
          id: generateId(),
        },
      },
    },
    mockVersion
  );

  const mockUpdatePurposeTemplateRiskAnalysis = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateProcessUpdateResponse);

  const mockPollRetries = 2;
  const mockGetPurposeTemplateResponse = getMockWithMetadata(
    mockPurposeTemplate,
    mockVersion
  );
  const mockGetPurposeTemplate = vi.fn(
    mockPollingResponse(mockGetPurposeTemplateResponse, mockPollRetries)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    updatePurposeTemplateRiskAnalysis: mockUpdatePurposeTemplateRiskAnalysis,
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockUpdatePurposeTemplateRiskAnalysis.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result =
      await purposeTemplateService.replacePurposeTemplateRiskAnalysis(
        unsafeBrandId(mockPurposeTemplate.id),
        mockRiskAnalysisFormTemplateSeed,
        getMockM2MAdminAppContext()
      );

    const expectedM2MRiskAnalysisFormTemplate: m2mGatewayApiV3.RiskAnalysisFormTemplate =
      {
        version: mockRiskAnalysisFormTemplate.version,
        answers: {
          ...Object.fromEntries(
            Object.entries(mockRiskAnalysisFormTemplateSeed.answers).map(
              ([key, value]) => [
                key,
                testToM2MRiskAnalysisTemplateAnswer({
                  ...value,
                  id: result.answers[key].id,
                }),
              ]
            )
          ),
        },
      };

    expect(result).toStrictEqual(expectedM2MRiskAnalysisFormTemplate);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .updatePurposeTemplateRiskAnalysis,
      params: {
        purposeTemplateId: mockPurposeTemplate.id,
      },
      body: mockRiskAnalysisFormTemplateSeed,
    });
    expect(mockUpdatePurposeTemplateRiskAnalysis).toHaveBeenCalledOnce();

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: mockPurposeTemplate.id },
    });
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(mockPollRetries);
  });

  it("Should throw missingMetadata in case the purpose template returned by the call has no metadata", async () => {
    mockGetPurposeTemplate.mockResolvedValueOnce({
      ...mockGetPurposeTemplateResponse,
      metadata: undefined,
    });

    await expect(
      purposeTemplateService.replacePurposeTemplateRiskAnalysis(
        unsafeBrandId(mockPurposeTemplate.id),
        mockRiskAnalysisFormTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockPollingResponse(
        mockGetPurposeTemplateResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.replacePurposeTemplateRiskAnalysis(
        unsafeBrandId(mockPurposeTemplate.id),
        mockRiskAnalysisFormTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
  });
});
