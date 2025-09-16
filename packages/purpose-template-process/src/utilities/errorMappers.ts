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
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeTemplateNameConflict", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeTemplatesErrorMapper = (): number =>
  HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const activatePurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "missingRiskAnalysisFormTemplate",
      "purposeTemplateNotInExpectedState",
      "riskAnalysisTemplateValidationFailed",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const suspendPurposeTemplateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeTemplateNotInExpectedState", () => HTTP_STATUS_BAD_REQUEST)
    .with("tenantNotAllowed", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeTemplateNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
