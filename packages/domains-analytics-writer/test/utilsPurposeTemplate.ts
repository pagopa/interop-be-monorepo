import {
  getMockValidRiskAnalysisFormTemplate,
  getMockRiskAnalysisTemplateAnswerAnnotation,
  getMockRiskAnalysisTemplateAnswerAnnotationDocument,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test/index.js";
import {
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  tenantKind,
} from "pagopa-interop-models";

export const getCompleteMockPurposeTemplate = (): PurposeTemplate => {
  const incompleteRiskAnalysisFormTemplate =
    getMockValidRiskAnalysisFormTemplate(tenantKind.PA);
  const riskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
    ...incompleteRiskAnalysisFormTemplate,
    singleAnswers: incompleteRiskAnalysisFormTemplate.singleAnswers.map(
      (a): RiskAnalysisTemplateSingleAnswer => ({
        ...a,
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
        },
        suggestedValues: ["a", "b"],
      })
    ),
    multiAnswers: incompleteRiskAnalysisFormTemplate.multiAnswers.map(
      (a): RiskAnalysisTemplateMultiAnswer => ({
        ...a,
        annotation: {
          ...getMockRiskAnalysisTemplateAnswerAnnotation(),
          docs: [getMockRiskAnalysisTemplateAnswerAnnotationDocument()],
        },
      })
    ),
  };

  return {
    ...getMockPurposeTemplate(),
    updatedAt: new Date(),
    purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    purposeFreeOfChargeReason: "Free of charge reason",
    purposeDailyCalls: 100,
  };
};
