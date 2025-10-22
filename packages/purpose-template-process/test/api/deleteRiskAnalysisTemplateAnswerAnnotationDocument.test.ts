/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateSingleAnswer,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /purposeTemplates/{id}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}", () => {
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

  purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (
    token: string,
    id: PurposeTemplateId = purposeTemplateId,
    answerId:
      | RiskAnalysisSingleAnswerId
      | RiskAnalysisMultiAnswerId = answer.id,
    documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId = annotationDocument.id
  ) =>
    request(api)
      .delete(
        `/purposeTemplates/${id}/riskAnalysis/answers/${answerId}/annotation/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, purposeTemplateId);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.active,
        [purposeTemplateState.draft]
      ),
      expectedStatus: 409,
    },
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: 404,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId),
      expectedStatus: 500,
    },
    {
      error: riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplateId,
        answer.id,
        annotationDocument.id
      ),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument =
        vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId);

      expect(res.status).toBe(expectedStatus);
    }
  );

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
          purposeTemplateId,
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
  ])("Should return 400 if invalid $name is passed", async ({ run }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await run(token);

    expect(res.status).toBe(400);
  });
});
