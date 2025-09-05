import {
  EServiceId,
  InternalError,
  PurposeTemplateId,
  TenantKind,
} from "pagopa-interop-models";

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
  | "missingExpectedFieldError"
  | "missingExpectedEService"
  | "invalidDescriptorState"
  | "missingDescriptor"
  | "eserviceAlreadyAssociated"
  | "unexpectedEServiceError"
  | "unexpectedAssociationEServiceError";

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

export function unexpectedTemplateFieldValueOrSuggestionError(
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

export function malformedTemplateFieldValueOrSuggestionError(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "malformedTemplateFieldValueOrSuggestion",
    detail: `Field ${fieldName} has conflicting or invalid value and suggestion configuration`,
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
  dependencyField: string,
  expectedValue: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedTemplateDependencyValueError",
    detail: `Field ${dependentField} requires field ${dependencyField} value to be ${expectedValue}`,
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

export function missingExpectedEService(
  eserviceId: EServiceId
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "missingExpectedEService",
    detail: `EService ${eserviceId} is missing from the list of expected EServices`,
  });
}

export function invalidDescriptorStateError(
  eserviceId: EServiceId,
  expectedStates: string[]
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "invalidDescriptorState",
    detail: `EService ${eserviceId} has no valid descriptors. Expected ${expectedStates.join(
      ", "
    )}.`,
  });
}

export function missingDescriptorError(
  eserviceId: EServiceId
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "missingDescriptor",
    detail: `EService ${eserviceId} has no descriptors.`,
  });
}

export function eserviceAlreadyAssociatedError(
  eserviceId: EServiceId,
  purposeTemplateId: PurposeTemplateId
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "eserviceAlreadyAssociated",
    detail: `EService ${eserviceId} is already associated with purpose template ${purposeTemplateId}`,
  });
}

export function unexpectedEServiceError(
  reason: string,
  eserviceId: EServiceId
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedEServiceError",
    detail: `Unexpected error: ${reason} for eservice ${eserviceId}`,
  });
}

export function unexpectedAssociationEServiceError(
  reason: string,
  eserviceId: EServiceId
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedAssociationEServiceError",
    detail: `Missing expected association for eservice ${eserviceId}: ${reason}`,
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
