import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposeTemplates/:id/riskAnalysis/answers/:answerId/annotation/documents/:documentId/update", () => {
  const mockPurposeTemplateId = generateId();
  const mockAnswerId = generateId<RiskAnalysisSingleAnswerId>();
  const mockDocumentId =
    generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();
  const validAnnotationDocumentSeed: bffApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed =
    {
      prettyName: "New Document pretty name",
    };

  const mockCreatedRiskAnalysisAnswerAnnotation: bffApi.RiskAnalysisTemplateAnswerAnnotation =
    {
      id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
      text: "This is a new annotation text for the risk analysis answer",
      docs: [
        {
          id: mockDocumentId,
          name: "Document-1",
          path: "Document-1.pdf",
          prettyName: validAnnotationDocumentSeed.prettyName,
          contentType: "application/pdf",
          createdAt: new Date().toISOString(),
          checksum:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      ],
    };

  const mockValidRequestParameters = {
    purposeTemplateId: mockPurposeTemplateId,
    answerId: mockAnswerId,
    documentId: mockDocumentId,
    body: validAnnotationDocumentSeed,
  };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.updateRiskAnalysisTemplateAnswerAnnotationDocument =
      vi.fn().mockResolvedValue(mockCreatedRiskAnalysisAnswerAnnotation);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockPurposeTemplateId,
    answerId: string = mockAnswerId,
    documentId: string = mockDocumentId,
    body: bffApi.UpdateRiskAnalysisTemplateAnswerAnnotationDocumentSeed = validAnnotationDocumentSeed
  ): Promise<request.Response> =>
    request(api)
      .post(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedRiskAnalysisAnswerAnnotation);
  });

  it.each([
    {
      ...mockValidRequestParameters,
      purposeTemplateId: "invalid",
    },
    {
      ...mockValidRequestParameters,
      answerId: "invalid",
    },
    {
      ...mockValidRequestParameters,
      documentId: "invalid",
    },
    {
      ...mockValidRequestParameters,
      body: {},
    },
    {
      ...mockValidRequestParameters,
      body: { ...validAnnotationDocumentSeed, extraField: 1 },
    },
  ])(
    "Should return 400 if passed an invalid parameter %s",
    async ({ purposeTemplateId, answerId, documentId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        answerId,
        documentId,
        body as bffApi.UpdateEServiceDescriptorDocumentSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
