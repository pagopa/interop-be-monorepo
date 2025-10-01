import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
} = constants;

export const createPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "missingFreeOfChargeReason",
      "riskAnalysisTemplateValidationFailed",
      "ruleSetNotFoundError",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeTemplateNameConflict", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeTemplatesErrorMapper = (): number =>
  HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const deletePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedState", () => HTTP_STATUS_CONFLICT)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteRiskAnalysisTemplateAnswerAnnotationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedState", () => HTTP_STATUS_CONFLICT)
    .with(
      "purposeTemplateNotFound",
      "riskAnalysisTemplateNotFound",
      "riskAnalysisTemplateAnswerNotFound",
      "riskAnalysisTemplateAnswerAnnotationNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedState", () => HTTP_STATUS_CONFLICT)
    .with(
      "purposeTemplateNotFound",
      "riskAnalysisTemplateNotFound",
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
