import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

export const getPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eserviceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantKindNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getRiskAnalysisDocumentErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeVersionDocumentNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deletePurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationIsNotTheConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeVersionCannotBeDeleted", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const rejectPurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationIsNotTheProducer", () => HTTP_STATUS_FORBIDDEN)
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updatePurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("eServiceModeNotAllowed", () => HTTP_STATUS_BAD_REQUEST)
    .with("missingFreeOfChargeReason", () => HTTP_STATUS_BAD_REQUEST)
    .with("tenantKindNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with("riskAnalysisValidationFailed", () => HTTP_STATUS_BAD_REQUEST)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationIsNotTheConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeNotInDraftState", () => HTTP_STATUS_FORBIDDEN)
    .with("eserviceNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with("tenantNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deletePurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationIsNotTheConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeCannotBeDeleted", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const archivePurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationIsNotTheConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendedPurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("notValidVersionState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("organizationIsNotTheConsumer", () => HTTP_STATUS_FORBIDDEN)
    .with("missingFreeOfChargeReason", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantKindNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("riskAnalysisValidationFailed", () => HTTP_STATUS_FORBIDDEN)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("duplicatedPurposeName", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createPurposeFromEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "organizationIsNotTheConsumer",
      "tenantKindNotFound",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with(
      "eserviceNotFound",
      "eServiceModeNotAllowed",
      "eserviceRiskAnalysisNotFound",
      "missingFreeOfChargeReason",
      "agreementNotFound",
      "riskAnalysisValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("duplicatedPurposeName", () => HTTP_STATUS_CONFLICT)
    .with("tenantNotFound", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
