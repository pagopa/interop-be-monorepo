import { TenantKind } from "pagopa-interop-models";

export class RiskAnalysisValidationError extends Error {
  public issues: RiskAnalysisValidationIssue[];

  constructor(issues: RiskAnalysisValidationIssue[]) {
    super(`Risk analysis validation failed`);

    this.issues = issues;
  }
}

export type RiskAnalysisValidationIssue = string & {
  readonly __brand: unique symbol;
};
function riskAnalyisisValidationIssue(
  message: string
): RiskAnalysisValidationIssue {
  return message as RiskAnalysisValidationIssue;
}

export function noRulesVersionFoundError(
  kind: TenantKind
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(
    `Ruleset version for tenant kind ${kind} not found`
  );
}

export function unexpectedRulesVersionError(
  version: string
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(`Unexpected ruleset version ${version}`);
}

export function unexpectedFieldError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(`Unexpected field ${fieldName}`);
}

export function unexpectedFieldValue(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(
    `Field ${fieldName} should be one of ${Array.from(allowedValues).join(",")}`
  );
}

export function dependencyNotFoundError(
  dependentField: string,
  depencencyField: string
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(
    `Field ${dependentField} expects field ${depencencyField} to be in the form`
  );
}

export function unexpectedDependencyValueError(
  dependentField: string,
  depencencyField: string,
  expectedValue: string
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(
    `Field ${dependentField} requires field ${depencencyField} value to be ${expectedValue}`
  );
}

export function unexpectedFieldFormatError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(
    `Unexpected format for field ${fieldName}`
  );
}

export function missingExpectedFieldError(
  fieldName: string
): RiskAnalysisValidationIssue {
  return riskAnalyisisValidationIssue(
    `Expected field ${fieldName} not found in form`
  );
}
