import { TenantKind } from "pagopa-interop-models";

class RiskAnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function noRulesVersionFoundError(
  kind: TenantKind
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Ruleset version for tenant kind ${kind} not found`
  );
}

export function unexpectedRulesVersionError(
  version: string
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Unexpected ruleset version ${version}`
  );
}

export function unexpectedFieldError(
  fieldName: string
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(`Unexpected field ${fieldName}`);
}

export function unexpectedFieldValue(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Field ${fieldName} should be one of ${Array.from(allowedValues).join(",")}`
  );
}

export function dependencyNotFoundError(
  dependentField: string,
  depencencyField: string
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Field ${dependentField} expects field ${depencencyField} to be in the form`
  );
}

export function unexpectedDependencyValueError(
  dependentField: string,
  depencencyField: string,
  expectedValue: string
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Field ${dependentField} requires field ${depencencyField} value to be ${expectedValue}`
  );
}

export function unexpectedFieldFormatError(
  fieldName: string
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Unexpected format for field ${fieldName}`
  );
}

export function missingExpectedFieldError(
  fieldName: string
): RiskAnalysisValidationError {
  return new RiskAnalysisValidationError(
    `Expected field ${fieldName} not found in form`
  );
}
