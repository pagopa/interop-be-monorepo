import {
  EServiceTemplateRiskAnalysis,
  RiskAnalysis,
  RiskAnalysisForm,
  RiskAnalysisFormId,
  RiskAnalysisFormTemplate,
  RiskAnalysisFormTemplateId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
  TenantKind,
  generateId,
} from "pagopa-interop-models";
import { RiskAnalysisValidationIssue } from "./riskAnalysisValidationErrors.js";
import { DataType } from "./rules/riskAnalysisFormRules.js";

export type RiskAnalysisValidationInvalid = {
  type: "invalid";
  issues: RiskAnalysisValidationIssue[];
};

export type RiskAnalysisValidationValid<T> = {
  type: "valid";
  value: T;
};

export type RiskAnalysisValidationResult<T> =
  | RiskAnalysisValidationValid<T>
  | RiskAnalysisValidationInvalid;

export type RiskAnalysisFormToValidate = {
  version: string;
  answers: Record<string, string[]>;
};

export type RiskAnalysisValidatedMultiAnswer = {
  key: string;
  values: string[];
};

export type RiskAnalysisValidatedSingleAnswer = {
  key: string;
  value?: string;
};

export type RiskAnalysisValidatedSingleOrMultiAnswer =
  | {
      type: "single";
      answer: RiskAnalysisValidatedSingleAnswer;
    }
  | {
      type: "multi";
      answer: RiskAnalysisValidatedMultiAnswer;
    };

export type RiskAnalysisValidatedForm = {
  version: string;
  singleAnswers: RiskAnalysisValidatedSingleAnswer[];
  multiAnswers: RiskAnalysisValidatedMultiAnswer[];
};

export type ValidationRuleDependency = {
  fieldName: string;
  fieldValue: string;
};

export type ValidationRule = {
  fieldName: string;
  dataType: DataType;
  required: boolean;
  dependencies: ValidationRuleDependency[];
  allowedValues: Set<string> | undefined;
};

/* ===============================
  Purpose Template Risk Analysis 
================================== */

export type RiskAnalysisFormTemplateToValidate = {
  version: string;
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>;
};

export type RiskAnalysisTemplateAnswerToValidate = {
  values: string[];
  editable: boolean;
  annotation?: RiskAnalysisTemplateValidatedAnswerAnnotation;
  suggestedValues: string[];
  assistiveText?: string;
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
  assistiveText?: string;
};

export type RiskAnalysisTemplateValidatedMultiAnswer = {
  key: string;
  values: string[];
  editable: boolean;
  annotation?: RiskAnalysisTemplateValidatedAnswerAnnotation;
  assistiveText?: string;
};

export function riskAnalysisValidatedFormToNewRiskAnalysis(
  validatedForm: RiskAnalysisValidatedForm,
  name: RiskAnalysis["name"]
): RiskAnalysis {
  return {
    id: generateId<RiskAnalysisId>(),
    name,
    createdAt: new Date(),
    riskAnalysisForm:
      riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
  };
}

export function riskAnalysisValidatedFormToNewEServiceTemplateRiskAnalysis(
  validatedForm: RiskAnalysisValidatedForm,
  name: RiskAnalysis["name"],
  tenantKind: TenantKind
): EServiceTemplateRiskAnalysis {
  return {
    id: generateId<RiskAnalysisId>(),
    name,
    createdAt: new Date(),
    riskAnalysisForm:
      riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
    tenantKind,
  };
}

export function riskAnalysisValidatedFormToNewRiskAnalysisForm(
  validatedForm: RiskAnalysisValidatedForm
): RiskAnalysisForm {
  return {
    id: generateId<RiskAnalysisFormId>(),
    version: validatedForm.version,
    singleAnswers: validatedForm.singleAnswers.map((a) => ({
      ...a,
      id: generateId<RiskAnalysisSingleAnswerId>(),
    })),
    multiAnswers: validatedForm.multiAnswers.map((a) => ({
      ...a,
      id: generateId<RiskAnalysisMultiAnswerId>(),
    })),
  };
}

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
      assistiveText: a.assistiveText,
      suggestedValues: a.suggestedValues,
    })),
    multiAnswers: validatedForm.multiAnswers.map((a) => ({
      id: generateId<RiskAnalysisMultiAnswerId>(),
      key: a.key,
      values: a.values,
      editable: a.editable,
      annotation: mapAnnotation(a.annotation),
      assistiveText: a.assistiveText,
    })),
  };
}

export function riskAnalysisFormToRiskAnalysisFormToValidate(
  form: RiskAnalysisForm
): RiskAnalysisFormToValidate {
  return {
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
