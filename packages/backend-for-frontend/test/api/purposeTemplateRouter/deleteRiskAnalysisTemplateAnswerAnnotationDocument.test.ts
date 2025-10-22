/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PurposeTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateSingleAnswer,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId} test", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const riskAnalysisTemplate = getMockValidRiskAnalysisFormTemplate(
    tenantKind.PA
  );
  const annotationDocument =
    getMockRiskAnalysisTemplateAnswerAnnotationDocument();
  const answer: RiskAnalysisTemplateSingleAnswer = {
    ...riskAnalysisTemplate.singleAnswers[0],
    annotation: {
      ...getMockRiskAnalysisTemplateAnswerAnnotation(),
      docs: [annotationDocument],
    },
  };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.deleteRiskAnalysisTemplateAnswerAnnotationDocument =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    answerId:
      | RiskAnalysisSingleAnswerId
      | RiskAnalysisMultiAnswerId = answer.id,
    documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId = annotationDocument.id
  ) =>
    request(api)
      .delete(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    {
      name: "purpose template id",
      run: (token: string) =>
        makeRequest(token, "invalid" as PurposeTemplateId),
    },
    {
      name: "answer id",
      run: (token: string) =>
        makeRequest(
          token,
          generateId<PurposeTemplateId>(),
          "invalid" as RiskAnalysisSingleAnswerId
        ),
    },
    {
      name: "document id",
      run: (token: string) =>
        makeRequest(
          token,
          purposeTemplateId,
          answer.id,
          "invalid" as RiskAnalysisTemplateAnswerAnnotationDocumentId
        ),
    },
  ])("Should return 400 if an invalid $name is passed", async ({ run }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await run(token);

    expect(res.status).toBe(400);
  });
});
