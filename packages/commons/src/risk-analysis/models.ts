import {
  RiskAnalysis,
  RiskAnalysisForm,
  RiskAnalysisFormId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  TenantKind,
  generateId,
} from "pagopa-interop-models";
import { DataType } from "./rules/riskAnalysisFormRules.js";
import { RiskAnalysisValidationIssue } from "./riskAnalysisValidationErrors.js";

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
  tenantKind: TenantKind;
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
  tenantKind: TenantKind;
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

export function riskAnalysisValidatedFormToNewRiskAnalysisForm(
  validatedForm: RiskAnalysisValidatedForm
): RiskAnalysisForm {
  return {
    id: generateId<RiskAnalysisFormId>(),
    version: validatedForm.version,
    tenantKind: validatedForm.tenantKind,
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

export function riskAnalysisFormToRiskAnalysisFormToValidate(
  form: RiskAnalysisForm
): RiskAnalysisFormToValidate {
  return {
    version: form.version,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    tenantKind: form.tenantKind!,
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
