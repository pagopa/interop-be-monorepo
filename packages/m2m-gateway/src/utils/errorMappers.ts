import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as M2MGatewayErrorCodes } from "../model/errors.js";

type ErrorCodes = M2MGatewayErrorCodes | CommonErrorCodes;

const { HTTP_STATUS_NOT_FOUND, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const getCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposesErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeVersionErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeVersionNotFound", () => HTTP_STATUS_NOT_FOUND)
  .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

// eslint-disable-next-line sonarjs/no-identical-functions
export const getPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
