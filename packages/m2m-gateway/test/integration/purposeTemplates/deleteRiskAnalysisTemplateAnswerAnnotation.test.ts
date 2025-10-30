import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  RiskAnalysisSingleAnswerId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockDeletionPollingResponse,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("deleteRiskAnalysisTemplateAnswerAnnotation", () => {
  const mockApiPurposeTemplate = getMockWithMetadata(
    getMockedApiPurposeTemplate()
  );
  const answerId = generateId<RiskAnalysisSingleAnswerId>();

  const mockDeleteRiskAnalysisTemplateAnswerAnnotation = vi.fn();
  const mockGetPurposeTemplate = vi.fn(
    mockDeletionPollingResponse(mockApiPurposeTemplate, 2)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
    deleteRiskAnalysisTemplateAnswerAnnotation:
      mockDeleteRiskAnalysisTemplateAnswerAnnotation,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockDeleteRiskAnalysisTemplateAnswerAnnotation.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation(
      unsafeBrandId(mockApiPurposeTemplate.data.id),
      answerId,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient
          .deleteRiskAnalysisTemplateAnswerAnnotation,
      params: { purposeTemplateId: mockApiPurposeTemplate.data.id, answerId },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: mockApiPurposeTemplate.data.id },
    });
    expect(
      mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockDeletionPollingResponse(
        mockApiPurposeTemplate,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation(
        unsafeBrandId(mockApiPurposeTemplate.data.id),
        answerId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
