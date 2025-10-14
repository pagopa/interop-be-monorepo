import { InternalError, TenantKind } from "pagopa-interop-models";

type RiskAnalysisValidationIssueCode =
  | "rulesVersionNotFoundError"
  | "expiredRulesVersionError"
  | "unexpectedFieldError"
  | "unexpectedFieldValueError"
  | "dependencyNotFoundError"
  | "unexpectedDependencyValueError"
  | "unexpectedFieldFormatError"
  | "missingExpectedFieldError"
  | "incompatiblePersonalDataError";

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

export function rulesVersionNotFoundError(
  kind: TenantKind,
  version: string
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "rulesVersionNotFoundError",
    detail: `Ruleset version ${version} not found for tenant kind ${kind}`,
  });
}

export function expiredRulesVersionError(
  version: string,
  tenantKind: TenantKind
): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "expiredRulesVersionError",
    detail: `Ruleset version ${version} for tenant kind ${tenantKind} has expired`,
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

export function incompatiblePersonalDataError(): RiskAnalysisValidationIssue {
  return new RiskAnalysisValidationIssue({
    code: "incompatiblePersonalDataError",
    detail: `The usesPersonalData answer doesn't match the personalData flag of the eservice`,
  });
}
