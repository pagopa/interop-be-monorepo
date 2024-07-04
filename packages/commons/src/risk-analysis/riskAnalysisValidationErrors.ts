import { InternalError, TenantKind } from "pagopa-interop-models";

type RiskAnalysisValidationIssueCode =
  | "noRulesVersionFoundError"
  | "unexpectedRulesVersionError"
  | "unexpectedFieldError"
  | "unexpectedFieldValueError"
  | "dependencyNotFoundError"
  | "unexpectedDependencyValueError"
  | "unexpectedFieldFormatError"
  | "missingExpectedFieldError";

export class RiskAnalysisValidationIssue extends InternalError<RiskAnalysisValidationIssueCode> {
  constructor({
    code,
    detail,
  }: {
    code: RiskAnalysisValidationIssueCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function noRulesVersionFoundError(
  kind: TenantKind
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "noRulesVersionFoundError",
    detail: `Ruleset version for tenant kind ${kind} not found`,
  });
}

export function unexpectedRulesVersionError(
  version: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedRulesVersionError",
    detail: `Unexpected ruleset version ${version}`,
  });
}

export function unexpectedFieldError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedFieldError",
    detail: `Unexpected field ${fieldName}`,
  });
}

export function unexpectedFieldValueError(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedFieldValueError",
    detail: `Field ${fieldName} should be one of [${Array.from(
      allowedValues
    ).join(",")}]`,
  });
}

export function dependencyNotFoundError(
  dependentField: string,
  depencencyField: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "dependencyNotFoundError",
    detail: `Field ${dependentField} expects field ${depencencyField} to be in the form`,
  });
}

export function unexpectedDependencyValueError(
  dependentField: string,
  depencencyField: string,
  expectedValue: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedDependencyValueError",
    detail: `Field ${dependentField} requires field ${depencencyField} value to be ${expectedValue}`,
  });
}

export function unexpectedFieldFormatError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedFieldFormatError",
    detail: `Unexpected format for field ${fieldName}`,
  });
}

export function missingExpectedFieldError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "missingExpectedFieldError",
    detail: `Expected field ${fieldName} not found in form`,
  });
}
