import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as M2MGatewayErrorCodes } from "../model/errors.js";

type ErrorCodes = M2MGatewayErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
} = constants;

export const approveAgreementErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("agreementNotInPendingState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
