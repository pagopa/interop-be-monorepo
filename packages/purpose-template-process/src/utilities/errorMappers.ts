import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
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

export const linkEservicesToPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "associationEServicesForPurposeTemplateFailed",
      "tooManyEServicesForPurposeTemplate",
      "purposeTemplateNotInValidState",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "associationBetweenEServiceAndPurposeTemplateAlreadyExists",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const unlinkEServicesFromPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "disassociationEServicesFromPurposeTemplateFailed",
      "tooManyEServicesForPurposeTemplate",
      "purposeTemplateNotInValidState",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "associationBetweenEServiceAndPurposeTemplateDoesNotExist",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
