import { InternalError, TenantKind } from "pagopa-interop-models";

type RiskAnalysisTemplateValidationIssueCode =
  | "unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError"
  | "malformedRiskAnalysisTemplateFieldValueOrSuggestionError"
  | "riskAnalysisTemplateDependencyNotFoundError"
  | "unexpectedRiskAnalysisTemplateDependencyEditableError"
  | "unexpectedRiskAnalysisTemplateFieldValueError"
  | "unexpectedRiskAnalysisTemplateFieldError"
  | "noRiskAnalysisTemplateRulesVersionFoundError"
  | "unexpectedRiskAnalysisTemplateRulesVersionError"
  | "unexpectedRiskAnalysisTemplateDependencyValueError"
  | "missingExpectedRiskAnalysisTemplateFieldError";

export class RiskAnalysisTemplateValidationIssue extends InternalError<RiskAnalysisTemplateValidationIssueCode> {
  constructor({
    code,
    detail,
  }: {
    code: RiskAnalysisTemplateValidationIssueCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export type RiskAnalysisTemplateValidationInvalid = {
  type: "invalid";
  issues: RiskAnalysisTemplateValidationIssue[];
};

export type RiskAnalysisTemplateValidationValid<T> = {
  type: "valid";
  value: T;
};

export type RiskAnalysisTemplateValidationResult<T> =
  | RiskAnalysisTemplateValidationValid<T>
  | RiskAnalysisTemplateValidationInvalid;

export function unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError",
    detail: `Field ${fieldName} value or suggestion not allowed`,
  });
}

export function unexpectedRiskAnalysisTemplateFieldValueError(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedRiskAnalysisTemplateFieldValueError",
    detail: `Field ${fieldName} should be one of [${Array.from(
      allowedValues
    ).join(",")}]`,
  });
}

export function unexpectedRiskAnalysisTemplateFieldError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedRiskAnalysisTemplateFieldError",
    detail: `Unexpected field ${fieldName}`,
  });
}

export function malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "malformedRiskAnalysisTemplateFieldValueOrSuggestionError",
    detail: `Field ${fieldName} has conflicting or invalid value and suggestion configuration`,
  });
}

export function riskAnalysisTemplateDependencyNotFoundError(
  dependentField: string,
  dependencyField: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "riskAnalysisTemplateDependencyNotFoundError",
    detail: `Field ${dependentField} depends on ${dependencyField} which is missing`,
  });
}

export function unexpectedRiskAnalysisTemplateDependencyEditableError(
  dependentField: string,
  dependencyField: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedRiskAnalysisTemplateDependencyEditableError",
    detail: `Field ${dependentField} depends on ${dependencyField} which is editable`,
  });
}

export function noRiskAnalysisTemplateRulesVersionFoundError(
  kind: TenantKind
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "noRiskAnalysisTemplateRulesVersionFoundError",
    detail: `Ruleset version for tenant kind ${kind} not found`,
  });
}

export function unexpectedRiskAnalysisTemplateRulesVersionError(
  version: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedRiskAnalysisTemplateRulesVersionError",
    detail: `Unexpected ruleset version ${version}`,
  });
}
export function unexpectedRiskAnalysisTemplateDependencyValueError(
  dependentField: string,
  dependencyField: string,
  expectedValue: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedRiskAnalysisTemplateDependencyValueError",
    detail: `Field ${dependentField} requires field ${dependencyField} value to be ${expectedValue}`,
  });
}

export function missingExpectedRiskAnalysisTemplateFieldError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "missingExpectedRiskAnalysisTemplateFieldError",
    detail: `Expected field ${fieldName} not found in form`,
  });
}

export function invalidTemplateResult(
  issues: RiskAnalysisTemplateValidationIssue[]
): RiskAnalysisTemplateValidationInvalid {
  return {
    type: "invalid",
    issues,
  };
}

export function validTemplateResult<T>(
  value: T
): RiskAnalysisTemplateValidationResult<T> {
  return {
    type: "valid",
    value,
  };
}
