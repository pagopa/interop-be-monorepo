import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  RiskAnalysisFormTemplateToValidate,
  RiskAnalysisTemplateAnswerToValidate,
} from "pagopa-interop-commons";
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

export function riskAnalysisFormTemplateToApiRiskAnalysisFormTemplate(
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
    responseKey: answer.key,
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
    responseKey: answer.key,
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

export const annotationDocumentToApiAnnotationDocumentWithAnswerId =
  (annotationDocumentWithAnswerId: {
    answerId: string;
    document: RiskAnalysisTemplateAnswerAnnotationDocument;
  }): purposeTemplateApi.RiskAnalysisTemplateAnnotationDocumentWithAnswerId => ({
    answerId: annotationDocumentWithAnswerId.answerId,
    document: annotationDocumentToApiAnnotationDocument(
      annotationDocumentWithAnswerId.document
    ),
  });

// RiskAnalysisTemplateAnswerSeed don't require 'docs',
// but RiskAnalysisTemplateAnswerToValidate requires 'docs' property.
export const toRiskAnalysisTemplateAnswerToValidate = (
  answer: purposeTemplateApi.RiskAnalysisTemplateAnswerSeed
): RiskAnalysisTemplateAnswerToValidate => ({
  ...answer,
  annotation: answer.annotation
    ? {
        text: answer.annotation.text,
        docs: [],
      }
    : undefined,
});

// RiskAnalysisFormTemplateSeed have 'answers' without 'docs',
// but RiskAnalysisFormTemplateToValidate requires 'docs' property in answers.
export const toRiskAnalysisFormTemplateToValidate = (
  formTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed
): RiskAnalysisFormTemplateToValidate => ({
  version: formTemplate.version,
  answers: Object.entries(formTemplate.answers)
    .map(([answerKey, answerValue]) => ({
      key: answerKey,
      value: toRiskAnalysisTemplateAnswerToValidate(answerValue),
    }))
    .reduce(
      (acc, answer) => ({
        ...acc,
        [answer.key]: answer.value,
      }),
      {}
    ),
});

export function purposeTemplateToApiPurposeTemplateSeed(
  purposeTemplate: PurposeTemplate
): purposeTemplateApi.PurposeTemplateSeed {
  const form = purposeTemplate.purposeRiskAnalysisForm;

  if (!form) {
    return { ...purposeTemplate, purposeRiskAnalysisForm: undefined };
  }

  const updatedForm = {
    version: form.version,
    answers: {
      ...form.singleAnswers.reduce(
        (acc, singleAnswer) => ({
          ...acc,
          [singleAnswer.key]: singleAnswer.value ? [singleAnswer.value] : [],
        }),
        {}
      ),
      ...form.multiAnswers.reduce(
        (acc, multiAnswer) => ({
          ...acc,
          [multiAnswer.key]: multiAnswer.values,
        }),
        {}
      ),
    },
  };

  return {
    ...purposeTemplate,
    purposeRiskAnalysisForm: updatedForm,
  };
}
