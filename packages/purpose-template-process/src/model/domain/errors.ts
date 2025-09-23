import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
  PurposeTemplateState,
  TenantKind,
} from "pagopa-interop-models";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  ruleSetNotFoundError: "0005",
  annotationTextLengthError: "0006",
  hyperlinkDetectionError: "0007",
  purposeTemplateNotInValidState: "0008",
  purposeTemplateRiskAnalysisFormNotFound: "0009",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function missingFreeOfChargeReason(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Missing free of charge reason",
    code: "missingFreeOfChargeReason",
    title: "Missing free of charge reason",
  });
}

export function purposeTemplateNameConflict(
  purposeTemplateId: PurposeTemplateId,
  name: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template name conflict for ID ${purposeTemplateId} and name ${name}`,
    code: "purposeTemplateNameConflict",
    title: "Purpose Template name conflict",
  });
}

export function purposeTemplateNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Purpose Template found for ID ${purposeTemplateId}`,
    code: "purposeTemplateNotFound",
    title: "Purpose Template Not Found",
  });
}

export function riskAnalysisTemplateValidationFailed(
  reasons: RiskAnalysisTemplateValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis template validation failed. Reasons: ${reasons}`,
    code: "riskAnalysisTemplateValidationFailed",
    title: "Risk analysis template validation failed",
  });
}

export function ruleSetNotFoundError(
  tenantKind: TenantKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No risk analysis rule set found for target tenant kind ${tenantKind}`,
    code: "ruleSetNotFoundError",
    title: "No risk analysis rule set found for target tenant kind",
  });
}

export function purposeTemplateRiskAnalysisFormNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Purpose Template Risk Analysis Form found for ID ${purposeTemplateId}`,
    code: "purposeTemplateRiskAnalysisFormNotFound",
    title: "Purpose Template Risk Analysis Form Not Found",
  });
}

export function purposeTemplateNotInValidState(
  state: PurposeTemplateState,
  validStates: PurposeTemplateState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose template state is: ${state} but valid states are: ${validStates}`,
    code: "purposeTemplateNotInValidState",
    title: "Purpose template not in valid state",
  });
}

export function annotationTextLengthError(
  text: string,
  length: number,
  threshold: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Annotation text ${text} length ${length} is greater than ${threshold}`,
    code: "annotationTextLengthError",
    title: "Annotation text length error",
  });
}

export function hyperlinkDetectionError(text: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Hyperlink detection error for text ${text}`,
    code: "hyperlinkDetectionError",
    title: "Hyperlink detection error",
  });
}
