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
    id: generateId(),
    version: validatedForm.version,
    singleAnswers: validatedForm.singleAnswers.map((a) => ({
      id: generateId(),
      key: a.key,
      value: a.value,
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
