import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  EServiceDescriptorPurposeTemplate,
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
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
    .with(
      purposeTemplateState.draft,
      () => purposeTemplateApi.PurposeTemplateState.Enum.DRAFT
    )
    .with(
      purposeTemplateState.published,
      () => purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED
    )
    .with(
      purposeTemplateState.suspended,
      () => purposeTemplateApi.PurposeTemplateState.Enum.SUSPENDED
    )
    .with(
      purposeTemplateState.archived,
      () => purposeTemplateApi.PurposeTemplateState.Enum.ARCHIVED
    )
    .exhaustive();
}

export function apiPurposeTemplateStateToPurposeTemplateState(
  state: purposeTemplateApi.PurposeTemplateState
): PurposeTemplateState {
  return match<purposeTemplateApi.PurposeTemplateState, PurposeTemplateState>(
    state
  )
    .with(
      purposeTemplateApi.PurposeTemplateState.Enum.DRAFT,
      () => purposeTemplateState.draft
    )
    .with(
      purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED,
      () => purposeTemplateState.published
    )
    .with(
      purposeTemplateApi.PurposeTemplateState.Enum.SUSPENDED,
      () => purposeTemplateState.suspended
    )
    .with(
      purposeTemplateApi.PurposeTemplateState.Enum.ARCHIVED,
      () => purposeTemplateState.archived
    )
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

export const riskAnalysisAnswerToApiRiskAnalysisAnswer = (
  riskAnalysisAnswer:
    | RiskAnalysisTemplateSingleAnswer
    | RiskAnalysisTemplateMultiAnswer
): purposeTemplateApi.RiskAnalysisTemplateAnswer => ({
  id: riskAnalysisAnswer.id,
  values:
    "value" in riskAnalysisAnswer
      ? riskAnalysisAnswer.value
        ? [riskAnalysisAnswer.value]
        : []
      : (riskAnalysisAnswer as RiskAnalysisTemplateMultiAnswer).values,
  editable: riskAnalysisAnswer.editable,
  suggestedValues:
    "suggestedValues" in riskAnalysisAnswer
      ? riskAnalysisAnswer.suggestedValues
      : [],
  annotation: riskAnalysisAnswer.annotation
    ? purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation(
        riskAnalysisAnswer.annotation
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
      id: answer.id,
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
      id: answer.id,
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
          docs: annotation.docs.map(annotationDocumentToApiAnnotationDocument),
        }
      : undefined;

export const eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate =
  (
    eserviceDescriptorPurposeTemplate: EServiceDescriptorPurposeTemplate
  ): purposeTemplateApi.EServiceDescriptorPurposeTemplate => ({
    ...eserviceDescriptorPurposeTemplate,
    createdAt: eserviceDescriptorPurposeTemplate.createdAt.toJSON(),
  });

export const annotationDocumentToApiAnnotationDocument = (
  annotationDocument: RiskAnalysisTemplateAnswerAnnotationDocument
): purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument => ({
  ...annotationDocument,
  createdAt: annotationDocument.createdAt.toJSON(),
});
