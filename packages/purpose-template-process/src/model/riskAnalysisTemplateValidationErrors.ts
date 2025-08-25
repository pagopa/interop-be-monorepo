import { InternalError, TenantKind } from "pagopa-interop-models";

type RiskAnalysisTemplateValidationIssueCode =
  | "templateFieldValueNotAllowed"
  | "malformedTemplateFieldValueOrSuggestion"
  | "templateDependencyNotFound"
  | "templateDependencyNotBeingEditable"
  | "unexpectedTemplateFieldValueError"
  | "unexpectedTemplateFieldError"
  | "noRulesVersionTemplateFoundError"
  | "unexpectedTemplateRulesVersionError"
  | "unexpectedTemplateDependencyValueError"
  | "missingExpectedFieldError";

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

export function unexpectedTemplateFieldValueOrSuggestion(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "templateFieldValueNotAllowed",
    detail: `Field ${fieldName} value or suggestion not allowed`,
  });
}

export function unexpectedTemplateFieldValueError(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedTemplateFieldValueError",
    detail: `Field ${fieldName} should be one of [${Array.from(
      allowedValues
    ).join(",")}]`,
  });
}

export function unexpectedTemplateFieldError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedTemplateFieldError",
    detail: `Unexpected field ${fieldName}`,
  });
}

export function malformedTemplateFieldValueOrSuggestion(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "malformedTemplateFieldValueOrSuggestion",
    detail: `Malformed field ${fieldName} contains both value and suggestion`,
  });
}

export function templateDependencyNotFoundError(
  dependentField: string,
  dependencyField: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "templateDependencyNotFound",
    detail: `Field ${dependentField} depends on ${dependencyField} which is missing`,
  });
}

export function unexpectedTemplateDependencyEditableError(
  dependentField: string,
  dependencyField: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "templateDependencyNotBeingEditable",
    detail: `Field ${dependentField} depends on ${dependencyField} which is editable`,
  });
}

export function noRulesVersionTemplateFoundError(
  kind: TenantKind
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "noRulesVersionTemplateFoundError",
    detail: `Ruleset version for tenant kind ${kind} not found`,
  });
}

export function unexpectedTemplateRulesVersionError(
  version: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedTemplateRulesVersionError",
    detail: `Unexpected ruleset version ${version}`,
  });
}
export function unexpectedTemplateDependencyValueError(
  dependentField: string,
  depencencyField: string,
  expectedValue: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedTemplateDependencyValueError",
    detail: `Field ${dependentField} requires field ${depencencyField} value to be ${expectedValue}`,
  });
}

export function missingExpectedTemplateFieldError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "missingExpectedFieldError",
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
