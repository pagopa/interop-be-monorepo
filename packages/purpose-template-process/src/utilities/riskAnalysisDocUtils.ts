import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
} from "pagopa-interop-models";

/**
 * Finds answer IDs in the RiskAnalysisFormTemplate that are not present
 * in the provided seed of answers in the PurposeTemplateSeed.
 *
 * This function identifies document's annotations linked to answers
 * that have been removed in the update operation.
 */

function findRemovedAnswerWithAnnotationDocs(
  updatedFormTemplate: purposeTemplateApi.PurposeTemplateSeed,
  formTemplate: RiskAnalysisFormTemplate | undefined
): RiskAnalysisTemplateAnswerAnnotationDocument[] {
  if (!formTemplate) {
    return [];
  }

  const incomingAnswersKeys = new Set(
    Object.keys(updatedFormTemplate.purposeRiskAnalysisForm?.answers || {})
  );

  return [...formTemplate.singleAnswers, ...formTemplate.multiAnswers]
    .filter((answer) => !incomingAnswersKeys.has(answer.key))
    .flatMap((answer) => answer.annotation?.docs || []);
}

export function getAnnotationDocumentPathsForRemovedAnswers(
  purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed,
  purposeTemplate: PurposeTemplate
): string[] {
  if (!purposeTemplateSeed.purposeRiskAnalysisForm) {
    return [];
  }
  return findRemovedAnswerWithAnnotationDocs(
    purposeTemplateSeed,
    purposeTemplate.purposeRiskAnalysisForm
  ).map((document) => document.path);
}

export function addAnnotationDocumentToUpdatedAnswerIfNeeded(
  purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed,
  existentFormTemplate: RiskAnalysisFormTemplate,
  newFormTemplate: RiskAnalysisFormTemplate
): RiskAnalysisFormTemplate {
  const answerWithAnnotationDocs = retrieveUpdatedAnswerWithAnnotationDocs(
    purposeTemplateSeed,
    existentFormTemplate
  );

  if (
    Object.keys(answerWithAnnotationDocs).length === 0 ||
    !answerWithAnnotationDocs
  ) {
    return newFormTemplate;
  }

  const updatedSingleAnswers: RiskAnalysisTemplateSingleAnswer[] =
    newFormTemplate.singleAnswers.map((answer) => {
      const docs = answerWithAnnotationDocs[answer.key];

      return docs
        ? {
            ...answer,
            suggestedValues: answer.suggestedValues,
            annotation: answer.annotation && {
              ...answer.annotation,
              docs,
            },
          }
        : answer;
    });

  const updatedMultiAnswer: RiskAnalysisTemplateMultiAnswer[] =
    newFormTemplate.multiAnswers.map((answer) => {
      const docs = answerWithAnnotationDocs[answer.key];

      return docs
        ? {
            ...answer,
            annotation: answer.annotation && {
              ...answer.annotation,
              docs,
            },
          }
        : answer;
    });

  return {
    ...newFormTemplate,
    singleAnswers: updatedSingleAnswers,
    multiAnswers: updatedMultiAnswer,
  };
}

function retrieveUpdatedAnswerWithAnnotationDocs(
  purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed,
  formTemplate: RiskAnalysisFormTemplate
): Record<string, RiskAnalysisTemplateAnswerAnnotationDocument[]> {
  const incomingAnswersIds = new Set(
    Object.keys(purposeTemplateSeed.purposeRiskAnalysisForm?.answers || {})
  );

  return [...formTemplate.singleAnswers, ...formTemplate.multiAnswers]
    .filter(
      (answer) =>
        incomingAnswersIds.has(answer.key) && answer.annotation?.docs.length
    )
    .reduce(
      (acc, answer) => ({
        ...acc,
        [answer.key]: answer.annotation?.docs || [],
      }),
      {}
    );
}
