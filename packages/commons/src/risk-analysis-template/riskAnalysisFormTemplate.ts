import {
  generateId,
  RiskAnalysisFormTemplate,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export type RiskAnalysisFormTemplateToValidate = {
  version: string;
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>;
};

export type RiskAnalysisTemplateAnswerToValidate = {
  values: string[];
  editable: boolean;
  annotation?: RiskAnalysisTemplateValidatedAnswerAnnotation;
  suggestedValues: string[];
};

export type RiskAnalysisTemplateValidatedAnswerAnnotation = {
  text: string;
  docs: RiskAnalysisTemplateAnswerAnnotationDocument[];
};

export type RiskAnalysisTemplateAnswerAnnotationDocument = {
  name: string;
  contentType: string;
  prettyName: string;
  path: string;
};

export type RiskAnalysisTemplateValidatedForm = {
  version: string;
  singleAnswers: RiskAnalysisTemplateValidatedSingleAnswer[];
  multiAnswers: RiskAnalysisTemplateValidatedMultiAnswer[];
};

export type RiskAnalysisTemplateValidatedSingleOrMultiAnswer =
  | {
      type: "single";
      answer: RiskAnalysisTemplateValidatedSingleAnswer;
    }
  | {
      type: "multi";
      answer: RiskAnalysisTemplateValidatedMultiAnswer;
    };

export type RiskAnalysisTemplateValidatedSingleAnswer = {
  key: string;
  value?: string;
  editable: boolean;
  annotation?: RiskAnalysisTemplateValidatedAnswerAnnotation;
  suggestedValues: string[];
};

export type RiskAnalysisTemplateValidatedMultiAnswer = {
  key: string;
  values: string[];
  editable: boolean;
  annotation?: RiskAnalysisTemplateValidatedAnswerAnnotation;
};

export function riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
  validatedForm: RiskAnalysisTemplateValidatedForm
): RiskAnalysisFormTemplate {
  return {
    id: generateId(),
    version: validatedForm.version,
    singleAnswers: validatedForm.singleAnswers.map((a) => ({
      id: generateId(),
      key: a.key,
      ...(a.value ? { value: a.value } : {}),
      editable: a.editable,
      suggestedValues: a.suggestedValues,
      ...(a.annotation ? { annotation: mapAnnotation(a.annotation) } : {}),
    })),
    multiAnswers: validatedForm.multiAnswers.map((a) => ({
      id: generateId(),
      key: a.key,
      values: a.values,
      editable: a.editable,
      ...(a.annotation ? { annotation: mapAnnotation(a.annotation) } : {}),
    })),
  };
}

export function riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
  form: RiskAnalysisFormTemplate
): RiskAnalysisFormTemplateToValidate {
  return {
    version: form.version,
    answers: {
      ...form.singleAnswers.reduce(
        (acc, singleAnswer) => ({
          ...acc,
          [singleAnswer.key]: {
            values: singleAnswer.value ? [singleAnswer.value] : [],
            editable: singleAnswer.editable,
            suggestedValues: singleAnswer.suggestedValues,
            ...(singleAnswer.annotation
              ? { annotation: singleAnswer.annotation }
              : {}),
          },
        }),
        {}
      ),
      ...form.multiAnswers.reduce(
        (acc, multiAnswer) => ({
          ...acc,
          [multiAnswer.key]: {
            values: multiAnswer.values,
            editable: multiAnswer.editable,
            suggestedValues: [],
            ...(multiAnswer.annotation
              ? { annotation: multiAnswer.annotation }
              : {}),
          },
        }),
        {}
      ),
    },
  };
}

export function riskAnalysisValidatedAnswerToRiskAnalysisAnswer(
  validatedAnswer: Extract<
    RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
    { type: "single" }
  >
): RiskAnalysisTemplateSingleAnswer;

export function riskAnalysisValidatedAnswerToRiskAnalysisAnswer(
  validatedAnswer: Extract<
    RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
    { type: "multi" }
  >
): RiskAnalysisTemplateMultiAnswer;

export function riskAnalysisValidatedAnswerToRiskAnalysisAnswer(
  validatedAnswer: RiskAnalysisTemplateValidatedSingleOrMultiAnswer
): RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer {
  return match(validatedAnswer) // This match help to distinguish properly brandedtype for Answer Id
    .with({ type: "single" }, (a) => {
      const { annotation, ...data } = a.answer;
      return {
        ...data,
        id: generateId<RiskAnalysisSingleAnswerId>(),
        ...(annotation ? { annotation: mapAnnotation(annotation) } : {}),
      };
    })
    .with({ type: "multi" }, (a) => {
      const { annotation, ...data } = a.answer;
      return {
        ...data,
        id: generateId<RiskAnalysisMultiAnswerId>(),
        ...(annotation ? { annotation: mapAnnotation(annotation) } : {}),
      };
    })
    .exhaustive();
}

function mapAnnotation(
  annotation: RiskAnalysisTemplateValidatedAnswerAnnotation
): RiskAnalysisTemplateAnswerAnnotation {
  return {
    id: generateId(),
    text: annotation.text,
    docs: annotation.docs.map((d) => ({
      id: generateId(),
      ...d,
      createdAt: new Date(),
    })),
  };
}
