import { DataType } from "./riskAnalysisTemplates.js";

export type RiskAnalysisFormToValidate = {
  version: string;
  // TODO really needed to have string | string[] and all the consequent logic?
  answers: Record<string, string | string[]>;
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
