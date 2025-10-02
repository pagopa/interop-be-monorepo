import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
  PurposeTemplateState,
  RiskAnalysisFormTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  TenantId,
  TenantKind,
} from "pagopa-interop-models";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  ruleSetNotFoundError: "0005",
  tenantNotAllowed: "0006",
  purposeTemplateNotInExpectedStates: "0007",
  purposeTemplateStateConflict: "0008",
  purposeTemplateRiskAnalysisFormNotFound: "0009",
  riskAnalysisTemplateAnswerNotFound: "0010",
  riskAnalysisTemplateAnswerAnnotationNotFound: "0011",
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound: "0012",
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

export function tenantNotAllowed(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not allowed to perform the operation because it's not the creator`,
    code: "tenantNotAllowed",
    title: "Tenant not allowed",
  });
}

export function purposeTemplateNotInExpectedStates(
  purposeTemplateId: PurposeTemplateId,
  currentState: PurposeTemplateState,
  expectedStates: PurposeTemplateState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template ${purposeTemplateId} not in expected states (current state: ${currentState}, expected states: ${expectedStates.toString()})`,
    code: "purposeTemplateNotInExpectedStates",
    title: "Purpose Template not in expected states",
  });
}

export function purposeTemplateStateConflict(
  purposeTemplateId: PurposeTemplateId,
  state: PurposeTemplateState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template ${purposeTemplateId} is already in state ${state}`,
    code: "purposeTemplateStateConflict",
    title: "Purpose Template state conflict",
  });
}

export function purposeTemplateRiskAnalysisFormNotFound(
  purposeTemplateId: PurposeTemplateId,
  riskAnalysisTemplateId?: RiskAnalysisFormTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Form found for Purpose Template ${purposeTemplateId}${
      riskAnalysisTemplateId
        ? ` and Risk Analysis Template Form ${riskAnalysisTemplateId}`
        : ""
    }`,
    code: "purposeTemplateRiskAnalysisFormNotFound",
    title: "Purpose Template Risk Analysis Form Not Found",
  });
}

export function riskAnalysisTemplateAnswerNotFound(
  purposeTemplateId: PurposeTemplateId,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Answer found for Purpose Template ${purposeTemplateId} and Answer ${answerId}`,
    code: "riskAnalysisTemplateAnswerNotFound",
    title: "Risk Analysis Template Answer Not Found",
  });
}

export function riskAnalysisTemplateAnswerAnnotationNotFound(
  purposeTemplateId: PurposeTemplateId,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Answer Annotation found for Purpose Template ${purposeTemplateId} and Answer ${answerId}`,
    code: "riskAnalysisTemplateAnswerAnnotationNotFound",
    title: "Risk Analysis Template Answer Annotation Not Found",
  });
}

export function riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
  purposeTemplateId: PurposeTemplateId,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Answer Annotation Document found for Purpose Template ${purposeTemplateId}, Answer ${answerId} and Document ${documentId}`,
    code: "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
    title: "Risk Analysis Template Answer Annotation Document Not Found",
  });
}
