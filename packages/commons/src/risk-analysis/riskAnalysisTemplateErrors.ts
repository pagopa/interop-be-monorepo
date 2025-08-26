import { InternalError, TenantKind } from "pagopa-interop-models";

type RiskAnalysisTemplateIssueCode =
  | "formTemplateConfigNotFoundError"
  | "tenantKindTemplateConfigNotFoundError"
  | "incompatibleConfigError"
  | "unexpectedEmptyAnswerError"
  | "answerNotFoundInConfigError"
  | "unexpectedQuestionTypeError";

export class RiskAnalysisTemplateIssue extends InternalError<RiskAnalysisTemplateIssueCode> {
  constructor({
    code,
    detail,
  }: {
    code: RiskAnalysisTemplateIssueCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function formTemplateConfigNotFoundError(
  templateVersion: string
): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "formTemplateConfigNotFoundError",
    detail: `Config version ${templateVersion} not found`,
  });
}

export function tenantKindTemplateConfigNotFoundError(
  tenantKind: TenantKind
): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "tenantKindTemplateConfigNotFoundError",
    detail: `Config for Tenant Kind ${tenantKind} not found`,
  });
}

export function incompatibleConfigError(
  questionId: string,
  configId: string
): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "incompatibleConfigError",
    detail: `Question ${questionId} not compatible with config ${configId}`,
  });
}

export function unexpectedEmptyAnswerError(
  questionId: string
): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "unexpectedEmptyAnswerError",
    detail: `Unexpected empty answer for ${questionId}`,
  });
}

export function answerNotFoundInConfigError(
  questionId: string,
  configId: string
): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "answerNotFoundInConfigError",
    detail: `Answer ${questionId} not found in config ${configId}`,
  });
}

export function unexpectedQuestionTypeError(
  questionType: string
): RiskAnalysisTemplateIssue {
  return new RiskAnalysisTemplateIssue({
    code: "unexpectedQuestionTypeError",
    detail: `Unexpected question type in template: ${questionType}`,
  });
}
