import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
  RiskAnalysisFormTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "pagopa-interop-models";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound: "0005",
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

export function riskAnalysisTemplateAnswerAnnotationDocumentNotFound({
  purposeTemplateId,
  riskAnalysisTemplateId,
  answerId,
  annotationId,
  documentId,
}: {
  purposeTemplateId: PurposeTemplateId;
  riskAnalysisTemplateId: RiskAnalysisFormTemplateId;
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
  annotationId: RiskAnalysisTemplateAnswerAnnotationId;
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId;
}): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis template answer annotation document ${documentId} not found for purpose template ${purposeTemplateId}, risk analysis form template ${riskAnalysisTemplateId}, answer ${answerId} and annotation ${annotationId}`,
    code: "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
    title: "`Risk analysis template answer annotation document not found",
  });
}
