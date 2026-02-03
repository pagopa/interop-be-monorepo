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
      "invalidFreeOfChargeReason",
      "missingFreeOfChargeReason",
      "riskAnalysisTemplateValidationFailed",
      "ruleSetNotFoundError",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeTemplateTitleConflict", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeTemplatesErrorMapper = (): number =>
  HTTP_STATUS_INTERNAL_SERVER_ERROR;

const commonPurposeTemplatesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number => commonPurposeTemplatesErrorMapper(error);

export const getPurposeTemplateEServiceDescriptorsErrorMapper = (
  error: ApiError<ErrorCodes>
): number => commonPurposeTemplatesErrorMapper(error);

export const getPurposeTemplateEServiceDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotFound",
      "eServiceDescriptorPurposeTemplateNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getRiskAnalysisTemplateAnnotationDocumentsErrorMapper = (
  error: ApiError<ErrorCodes>
): number => commonPurposeTemplatesErrorMapper(error);

export const linkEservicesToPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "associationEServicesForPurposeTemplateFailed",
      "tooManyEServicesForPurposeTemplate",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "associationBetweenEServiceAndPurposeTemplateAlreadyExists",
      "purposeTemplateNotInExpectedStates",
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
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "associationBetweenEServiceAndPurposeTemplateDoesNotExist",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_CONFLICT
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updatePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "invalidFreeOfChargeReason",
      "riskAnalysisTemplateValidationFailed",
      "missingFreeOfChargeReason",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "purposeTemplateTitleConflict",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addPurposeTemplateAnswerAnnotationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotFound",
      "purposeTemplateRiskAnalysisFormNotFound",
      "riskAnalysisTemplateAnswerNotFound",
      "riskAnalysisTemplateAnswerAnnotationNotFound",
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      "tenantNotAllowed",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "conflictDocumentPrettyNameDuplicate",
      "conflictDuplicatedDocument",
      "annotationDocumentLimitExceeded",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createRiskAnalysisAnswerErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "hyperlinkDetectionError",
      "riskAnalysisTemplateValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "purposeTemplateStateConflict",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_CONFLICT
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
      "purposeTemplateNotFound",
      "riskAnalysisTemplateAnswerNotFound",
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
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
      "riskAnalysisTemplateAnswerNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "purposeTemplateNotInExpectedStates",
      "purposeTemplateStateConflict",
      () => HTTP_STATUS_CONFLICT
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "purposeTemplateRiskAnalysisFormNotFound",
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const activatePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("riskAnalysisTemplateValidationFailed", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "purposeTemplateNotInExpectedStates",
      "purposeTemplateStateConflict",
      "invalidAssociatedEServiceForPublicationError",
      () => HTTP_STATUS_CONFLICT
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

const suspendOrArchivePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotInExpectedStates",
      "purposeTemplateStateConflict",
      () => HTTP_STATUS_CONFLICT
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number => suspendOrArchivePurposeTemplateErrorMapper(error);

export const archivePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number => suspendOrArchivePurposeTemplateErrorMapper(error);

export const deletePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedStates", () => HTTP_STATUS_CONFLICT)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteRiskAnalysisTemplateAnswerAnnotationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedStates", () => HTTP_STATUS_CONFLICT)
    .with(
      "purposeTemplateNotFound",
      "riskAnalysisTemplateAnswerNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedStates", () => HTTP_STATUS_CONFLICT)
    .with(
      "purposeTemplateNotFound",
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "conflictDocumentPrettyNameDuplicate",
      "purposeTemplateNotInExpectedStates",
      () => HTTP_STATUS_CONFLICT
    )
    .with(
      "purposeTemplateNotFound",
      "purposeTemplateRiskAnalysisFormNotFound",
      "riskAnalysisTemplateAnswerNotFound",
      "riskAnalysisTemplateAnswerAnnotationNotFound",
      "riskAnalysisTemplateAnswerAnnotationDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updatePurposeTemplateRiskAnalysisErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("riskAnalysisTemplateValidationFailed", () => HTTP_STATUS_BAD_REQUEST)
    .with("purposeTemplateNotInExpectedStates", () => HTTP_STATUS_CONFLICT)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addRiskAnalysisTemplateDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotFound",
      "purposeTemplateRiskAnalysisFormNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getRiskAnalysisTemplateDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotFound",
      "purposeTemplateRiskAnalysisFormNotFound",
      "purposeTemplateRiskAnalysisTemplateDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getRiskAnalysisTemplateSignedDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "purposeTemplateNotFound",
      "purposeTemplateRiskAnalysisFormNotFound",
      "purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
