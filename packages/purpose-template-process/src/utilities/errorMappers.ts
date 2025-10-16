import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
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

export const getPurposeTemplatesErrorMapper = (): number =>
  HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const getPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeTemplateEServiceDescriptorsErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const linkEservicesToPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "associationEServicesForPurposeTemplateFailed",
      "tooManyEServicesForPurposeTemplate",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "associationBetweenEServiceAndPurposeTemplateAlreadyExists",
      () => HTTP_STATUS_CONFLICT
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const unlinkEServicesFromPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "disassociationEServicesFromPurposeTemplateFailed",
      "tooManyEServicesForPurposeTemplate",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "associationBetweenEServiceAndPurposeTemplateDoesNotExist",
      () => HTTP_STATUS_CONFLICT
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updatePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotInExpectedStates",
      "riskAnalysisTemplateValidationFailed",
      "missingFreeOfChargeReason",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeTemplateNameConflict", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addPurposeTemplateAnswerAnnotationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedStates", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "purposeTemplateNotFound",
      "purposeTemplateRiskAnalysisFormNotFound",
      "riskAnalysisTemplateAnswerNotFound",
      "riskAnalysisTemplateAnswerAnnotationNotFound",
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "conflictDocumentPrettyNameDuplicate",
      "conflictDuplicatedDocument",
      "annotationDocumentLimitExceeded",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createRiskAnalysisAnswerErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "riskAnalysisTemplateValidationFailed",
      "hyperlinkDetectionError",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "purposeTemplateRiskAnalysisFormNotFound",
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addRiskAnalysisAnswerAnnotationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "riskAnalysisTemplateValidationFailed",
      "hyperlinkDetectionError",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "purposeTemplateNotFound",
      "riskAnalysisAnswerNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "purposeTemplateRiskAnalysisFormNotFound",
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const publishPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotInExpectedStates",
      "riskAnalysisTemplateValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateStateConflict", () => HTTP_STATUS_CONFLICT)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
