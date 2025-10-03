import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  EServiceDescriptorPurposeTemplate,
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export function purposeTemplateStateToApiPurposeTemplateState(
  input: PurposeTemplateState
): purposeTemplateApi.PurposeTemplateState {
  return match<PurposeTemplateState, purposeTemplateApi.PurposeTemplateState>(
    input
  )
    .with(purposeTemplateState.draft, () => "DRAFT")
    .with(purposeTemplateState.active, () => "ACTIVE")
    .with(purposeTemplateState.suspended, () => "SUSPENDED")
    .with(purposeTemplateState.archived, () => "ARCHIVED")
    .exhaustive();
}

export function apiPurposeTemplateStateToPurposeTemplateState(
  state: purposeTemplateApi.PurposeTemplateState
): PurposeTemplateState {
  return match<purposeTemplateApi.PurposeTemplateState, PurposeTemplateState>(
    state
  )
    .with("DRAFT", () => purposeTemplateState.draft)
    .with("ACTIVE", () => purposeTemplateState.active)
    .with("SUSPENDED", () => purposeTemplateState.suspended)
    .with("ARCHIVED", () => purposeTemplateState.archived)
    .exhaustive();
}

export const purposeTemplateToApiPurposeTemplate = (
  purposeTemplate: PurposeTemplate
): purposeTemplateApi.PurposeTemplate => ({
  ...purposeTemplate,
  state: purposeTemplateStateToApiPurposeTemplateState(purposeTemplate.state),
  createdAt: purposeTemplate.createdAt?.toJSON(),
  updatedAt: purposeTemplate.updatedAt?.toJSON(),
  purposeRiskAnalysisForm: purposeTemplate.purposeRiskAnalysisForm
    ? riskAnalysisFormTemplateToApiRiskAnalysisFormTemplate(
        purposeTemplate.purposeRiskAnalysisForm
      )
    : undefined,
});

function riskAnalysisFormTemplateToApiRiskAnalysisFormTemplate(
  riskAnalysisForm: RiskAnalysisFormTemplate
): purposeTemplateApi.RiskAnalysisFormTemplate {
  const apiSingleAnswersMap = singleAnswersToApiSingleAnswers(
    riskAnalysisForm.singleAnswers
  );
  const apiMultiAnswersMap = multiAnswersToApiMultiAnswers(
    riskAnalysisForm.multiAnswers
  );

  return {
    version: riskAnalysisForm.version,
    answers: apiSingleAnswersMap.concat(apiMultiAnswersMap).reduce(
      (acc, answer) => ({
        ...acc,
        [answer.responseKey]: answer.responseValue,
      }),
      {}
    ),
  };
}

export const multiAnswersToApiMultiAnswers = (
  multiAnswers: RiskAnalysisTemplateMultiAnswer[]
): Array<{
  responseKey: string;
  responseValue: purposeTemplateApi.RiskAnalysisTemplateAnswer;
}> =>
  multiAnswers.map((answer: RiskAnalysisTemplateMultiAnswer) => ({
    responseKey: answer.id,
    responseValue: {
      values: answer.values,
      editable: answer.editable,
      suggestedValues: [], // always empty for multi answers
      annotation:
        purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation(
          answer.annotation
        ),
    },
  }));

export const singleAnswersToApiSingleAnswers = (
  singleAnswers: RiskAnalysisTemplateSingleAnswer[]
): Array<{
  responseKey: string;
  responseValue: purposeTemplateApi.RiskAnalysisTemplateAnswer;
}> =>
  singleAnswers.map((answer: RiskAnalysisTemplateSingleAnswer) => ({
    responseKey: answer.id,
    responseValue: {
      values: answer.value ? [answer.value] : [],
      editable: answer.editable,
      suggestedValues: answer.suggestedValues,
      annotation:
        purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation(
          answer.annotation
        ),
    },
  }));

export const purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation =
  (
    annotation: RiskAnalysisTemplateAnswerAnnotation | undefined
  ): purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotation | undefined =>
    annotation
      ? {
          id: annotation.id,
          text: annotation.text,
          docs: annotation.docs.map((doc) => ({
            ...doc,
            createdAt: doc.createdAt?.toJSON(),
          })),
        }
      : undefined;

export const eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate =
  (
    eserviceDescriptorPurposeTemplate: EServiceDescriptorPurposeTemplate
  ): purposeTemplateApi.EServiceDescriptorPurposeTemplate => ({
    ...eserviceDescriptorPurposeTemplate,
    createdAt: eserviceDescriptorPurposeTemplate.createdAt.toJSON(),
  });
