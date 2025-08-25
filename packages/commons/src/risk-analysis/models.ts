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
