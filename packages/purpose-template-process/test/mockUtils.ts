import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  targetTenantKind,
} from "pagopa-interop-models";
import { getMockValidRiskAnalysisFormTemplate } from "pagopa-interop-commons-test";

function toAnswerDocumentToValidate(
  document: RiskAnalysisTemplateAnswerAnnotationDocument
): purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocumentSeed {
  return {
    documentId: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
    path: document.path,
    checksum: document.checksum,
  };
}

export const buildRiskAnalysisFormTemplateSeed = (
  riskAnalysisFormTemplate: RiskAnalysisFormTemplate
): purposeTemplateApi.RiskAnalysisFormTemplateSeed => ({
  version: riskAnalysisFormTemplate.version,
  answers: {
    ...riskAnalysisFormTemplate.singleAnswers.reduce(
      (acc, singleAnswer) => ({
        ...acc,
        [singleAnswer.key]: {
          values: singleAnswer.value ? [singleAnswer.value] : [],
          editable: singleAnswer.editable,
          suggestedValues: singleAnswer.suggestedValues,
          ...(singleAnswer.annotation
            ? {
                annotation: {
                  ...singleAnswer.annotation,
                  docs: singleAnswer.annotation.docs.map(
                    toAnswerDocumentToValidate
                  ),
                },
              }
            : {}),
        },
      }),
      {}
    ),
    ...riskAnalysisFormTemplate.multiAnswers.reduce(
      (acc, multiAnswer) => ({
        ...acc,
        [multiAnswer.key]: {
          values: multiAnswer.values,
          editable: multiAnswer.editable,
          suggestedValues: [],
          ...(multiAnswer.annotation
            ? {
                annotation: {
                  ...multiAnswer.annotation,
                  docs: multiAnswer.annotation.docs.map(
                    toAnswerDocumentToValidate
                  ),
                },
              }
            : {}),
        },
      }),
      {}
    ),
  },
});

export const getMockPurposeTemplateSeed = (
  riskAnalysisFormTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed = buildRiskAnalysisFormTemplateSeed(
    getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA)
  ),
  targetTenantKindParam: purposeTemplateApi.TargetTenantKind = targetTenantKind.PA
): purposeTemplateApi.PurposeTemplateSeed => ({
  targetDescription: "Test target description",
  targetTenantKind: targetTenantKindParam,
  purposeTitle: "Test purpose title",
  purposeDescription: "Test purpose description",
  purposeRiskAnalysisForm: riskAnalysisFormTemplate,
  purposeIsFreeOfCharge: true,
  purposeFreeOfChargeReason: "Test reason",
  purposeDailyCalls: 10,
  handlesPersonalData: true,
});
