import {
  RiskAnalysis,
  RiskAnalysisFormId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  generateId,
} from "pagopa-interop-models";
import { DataType } from "./rules/models.js";
import { RiskAnalysisValidationIssue } from "./riskAnalysisErrors.js";

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

export function riskAnalysisValidatedFormToNewRiskAnalysis(
  validatedForm: RiskAnalysisValidatedForm,
  name: RiskAnalysis["name"]
): RiskAnalysis {
  return {
    id: generateId<RiskAnalysisId>(),
    name,
    createdAt: new Date(),
    riskAnalysisForm: {
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
    },
  };
}
