/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockAuthData,
  getMockContext,
  getMockPurposeTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateSingleAnswer,
  TenantId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
} from "../integrationUtils.js";
import { riskAnalysisTemplateAnswerAnnotationDocumentNotFound } from "../../src/model/domain/errors.js";

describe("getRiskAnalysisTemplateAnswerAnnotationDocument", () => {
  it("should get the risk analysis template answer annotation document if it exists", async () => {
    const incompleteRiskAnalysisFormTemplate =
      getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
    const singleAnswer: RiskAnalysisTemplateSingleAnswer = {
      ...incompleteRiskAnalysisFormTemplate.singleAnswers[0],
      annotation: {
        ...getMockRiskAnalysisTemplateAnswerAnnotation(),
        docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
      },
    };
    const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
      ...incompleteRiskAnalysisFormTemplate,
      singleAnswers: [singleAnswer],
      multiAnswers: [],
    };

    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    };
    await addOnePurposeTemplate(purposeTemplate);

    const purposeTemplateResponse =
      await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: singleAnswer.id,
          documentId: singleAnswer.annotation!.docs[0].id,
        },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );
    expect(purposeTemplateResponse).toMatchObject({
      data: singleAnswer.annotation!.docs[0],
      metadata: { version: 0 },
    });
  });

  it("should throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound if the risk analysis template answer annotation document doesn't exist", async () => {
    const incompleteRiskAnalysisFormTemplate =
      getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
    const singleAnswer: RiskAnalysisTemplateSingleAnswer = {
      ...incompleteRiskAnalysisFormTemplate.singleAnswers[0],
      annotation: getMockRiskAnalysisTemplateAnswerAnnotation(),
    };
    const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
      ...incompleteRiskAnalysisFormTemplate,
      singleAnswers: [singleAnswer],
      multiAnswers: [],
    };

    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    };
    await addOnePurposeTemplate(purposeTemplate);

    const notExistingId =
      generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>();

    await expect(
      purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
        {
          purposeTemplateId: purposeTemplate.id,
          answerId: singleAnswer.id,
          documentId: notExistingId,
        },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(
      riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
        purposeTemplate.id,
        singleAnswer.id,
        notExistingId
      )
    );
  });
});
