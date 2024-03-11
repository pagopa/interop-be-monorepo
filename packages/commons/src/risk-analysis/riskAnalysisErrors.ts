import { TenantKind } from "pagopa-interop-models";

type RiskAnalysisValidationIssueCode =
  | "noRulesVersionFoundError"
  | "unexpectedRulesVersionError"
  | "unexpectedFieldError"
  | "unexpectedFieldValueError"
  | "dependencyNotFoundError"
  | "unexpectedDependencyValueError"
  | "unexpectedFieldFormatError"
  | "missingExpectedFieldError";

export class RiskAnalysisValidationIssue extends Error {
  public code: RiskAnalysisValidationIssueCode;
  public issue: string;
  constructor({
    code,
    issue,
  }: {
    code: RiskAnalysisValidationIssueCode;
    issue: string;
  }) {
    super(issue);
    this.code = code;
    this.issue = issue;
  }
}

export function noRulesVersionFoundError(
  kind: TenantKind
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "noRulesVersionFoundError",
    issue: `Ruleset version for tenant kind ${kind} not found`,
  });
}

export function unexpectedRulesVersionError(
  version: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedRulesVersionError",
    issue: `Unexpected ruleset version ${version}`,
  });
}

export function unexpectedFieldError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedFieldError",
    issue: `Unexpected field ${fieldName}`,
  });
}

export function unexpectedFieldValueError(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "unexpectedFieldValueError",
    issue: `Field ${fieldName} should be one of [${Array.from(
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
    issue: `Field ${dependentField} expects field ${depencencyField} to be in the form`,
  });
}

export function unexpectedDependencyValueError(
  dependentField: string,
  depencencyField: string,
  expectedValue: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    issue: `Field ${dependentField} requires field ${depencencyField} value to be ${expectedValue}`,
    code: "unexpectedDependencyValueError",
  });
}

export function unexpectedFieldFormatError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    issue: `Unexpected format for field ${fieldName}`,
    code: "unexpectedFieldFormatError",
  });
}

export function missingExpectedFieldError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    issue: `Expected field ${fieldName} not found in form`,
    code: "missingExpectedFieldError",
  });
}
