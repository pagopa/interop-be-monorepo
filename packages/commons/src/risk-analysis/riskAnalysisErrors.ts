import { TenantKind } from "pagopa-interop-models";
import { ValidationRule, ValidationRuleDependency } from "./models.js";

// Defining RiskAnalysisValidationError
type RiskAnalysisValidationError = {
  message: string;
};

export function noTemplateVersionFoundError(
  kind: TenantKind
): RiskAnalysisValidationError {
  return {
    message: `Template version for tenant kind ${kind} not found`,
  };
}

export function unexpectedTemplateVersionError(
  version: string
): RiskAnalysisValidationError {
  return {
    message: `Unexpected template version ${version}`,
  };
}

export function unexpectedFieldError(
  fieldName: string
): RiskAnalysisValidationError {
  return {
    message: `Unexpected field ${fieldName}`,
  };
}

export function unexpectedFieldValue(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisValidationError {
  return {
    message: `Field ${fieldName} should be one of ${Array.from(
      allowedValues
    ).join(",")}`,
  };
}

export function dependencyNotFound(
  dependentField: string,
  depencency: ValidationRuleDependency
): RiskAnalysisValidationError {
  return {
    message: `Field ${dependentField} expects field ${depencency.fieldName} to be in the form`,
  };
}

export function unexpectedDependencyValueError(
  dependentField: string,
  depencency: ValidationRuleDependency,
  expectedValue: string
): RiskAnalysisValidationError {
  return {
    message: `Field ${dependentField} requires field ${depencency.fieldName} value to be ${expectedValue}`,
  };
}

export function invalidFormAnswerError(
  fieldName: string,
  fieldValue: string | string[],
  validationRule: ValidationRule
): RiskAnalysisValidationError {
  return {
    message: `Field ${fieldName} has invalid value ${fieldValue} according to validation rule ${JSON.stringify(
      validationRule
    )}`,
  };
}

export function unexpectedFieldFormatError(
  fieldName: string
): RiskAnalysisValidationError {
  return {
    message: `Unexpected format for field ${fieldName}`,
  };
}

export function missingExpectedFieldError(
  fieldName: string
): RiskAnalysisValidationError {
  return {
    message: `Expected field ${fieldName} not found in form`,
  };
}
