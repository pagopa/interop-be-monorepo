import { InternalError } from "pagopa-interop-models";

type RiskAnalysisTemplateValidationIssueCode =
  | "fieldValueNotAllowed"
  | "unexpectedFieldValueError";

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

export function unexpectedFieldValueOrSuggestion(
  fieldName: string
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "fieldValueNotAllowed",
    detail: `Field ${fieldName} value or suggestion not allowed`,
  });
}

export function unexpectedFieldValueTemplateError(
  fieldName: string,
  allowedValues: Set<string>
): RiskAnalysisTemplateValidationIssue {
  return new RiskAnalysisTemplateValidationIssue({
    code: "unexpectedFieldValueError",
    detail: `Field ${fieldName} should be one of [${Array.from(
      allowedValues
    ).join(",")}]`,
  });
}
