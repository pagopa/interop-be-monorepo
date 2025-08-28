import {
  RiskAnalysisFormTemplate,
  RiskAnalysisFormTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  generateId,
} from "pagopa-interop-models";

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
    id: generateId<RiskAnalysisFormTemplateId>(),
    version: validatedForm.version,
    singleAnswers: validatedForm.singleAnswers.map((a) => ({
      id: generateId<RiskAnalysisSingleAnswerId>(),
      key: a.key,
      value: a.value,
      editable: a.editable,
      annotation: mapAnnotation(a.annotation),
      suggestedValues: a.suggestedValues,
    })),
    multiAnswers: validatedForm.multiAnswers.map((a) => ({
      id: generateId<RiskAnalysisMultiAnswerId>(),
      key: a.key,
      values: a.values,
      editable: a.editable,
      annotation: mapAnnotation(a.annotation),
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
            annotation: singleAnswer.annotation,
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
            annotation: multiAnswer.annotation,
          },
        }),
        {}
      ),
    },
  };
}

function mapAnnotation(
  annotation?: RiskAnalysisTemplateValidatedAnswerAnnotation
): RiskAnalysisTemplateAnswerAnnotation | undefined {
  return annotation
    ? {
        id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
        text: annotation.text,
        docs: annotation.docs.map((d) => ({
          id: generateId<RiskAnalysisTemplateAnswerAnnotationDocumentId>(),
          ...d,
          createdAt: new Date(),
        })),
      }
    : undefined;
}
