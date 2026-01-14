import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    generateId,
    pollingMaxRetriesExceeded,
    RiskAnalysisTemplateAnswerAnnotationDocumentId,
    unsafeBrandId,
} from "pagopa-interop-models";
import {
    getMockedApiPurposeTemplate,
    getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
    expectApiClientGetToHaveBeenCalledWith,
    expectApiClientPostToHaveBeenCalledWith,
    mockInteropBeClients,
    mockPollingResponse,
    purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";

describe("deleteRiskAnalysisTemplateAnswerAnnotationDocument", () => {
    const mockApiPurposeTemplate = getMockWithMetadata(
        getMockedApiPurposeTemplate()
    );
    const documentId =
        generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

    const mockDeleteRiskAnalysisTemplateAnnotationDocument = vi
        .fn()
        .mockResolvedValue(mockApiPurposeTemplate);
    const mockGetPurposeTemplate = vi.fn(
        mockPollingResponse(mockApiPurposeTemplate, 2)
    );

    mockInteropBeClients.purposeTemplateProcessClient = {
        getPurposeTemplate: mockGetPurposeTemplate,
        deleteRiskAnalysisTemplateAnnotationDocument:
            mockDeleteRiskAnalysisTemplateAnnotationDocument,
    } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

    beforeEach(() => {
        mockDeleteRiskAnalysisTemplateAnnotationDocument.mockClear();
        mockGetPurposeTemplate.mockClear();
    });

    it("Should succeed and perform API clients calls", async () => {
        await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
            unsafeBrandId(mockApiPurposeTemplate.data.id),
            documentId,
            getMockM2MAdminAppContext()
        );

        expectApiClientPostToHaveBeenCalledWith({
            mockPost:
                mockInteropBeClients.purposeTemplateProcessClient
                    .deleteRiskAnalysisTemplateAnnotationDocument,
            params: { purposeTemplateId: mockApiPurposeTemplate.data.id, documentId },
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

    it("Should throw missingMetadata in case the purpose returned by the DELETE call has no metadata", async () => {
        mockDeleteRiskAnalysisTemplateAnnotationDocument.mockResolvedValueOnce({
            metadata: undefined,
        });

        await expect(
            purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
                unsafeBrandId(mockApiPurposeTemplate.data.id),
                unsafeBrandId(documentId),
                getMockM2MAdminAppContext()
            )
        ).rejects.toThrowError(missingMetadata());
    });

    it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
        mockGetPurposeTemplate.mockResolvedValueOnce({
            data: mockApiPurposeTemplate.data,
            metadata: undefined,
        });

        await expect(
            purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
                unsafeBrandId(mockApiPurposeTemplate.data.id),
                unsafeBrandId(documentId),
                getMockM2MAdminAppContext()
            )
        ).rejects.toThrowError(missingMetadata());
    });

    it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
        mockGetPurposeTemplate.mockImplementation(
            mockPollingResponse(
                mockApiPurposeTemplate,
                config.defaultPollingMaxRetries + 1
            )
        );

        await expect(
            purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
                unsafeBrandId(mockApiPurposeTemplate.data.id),
                documentId,
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
