import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as BFFErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = BFFErrorCodes | CommonErrorCodes;

const { HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_NOT_FOUND } = constants;

export const bffGetCatalogErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const reversePurposeUpdateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getSelfcareErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("selfcareEntityNotFilled", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getSelfcareUserErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("selfcareEntityNotFilled", () => HTTP_STATUS_INTERNAL_SERVER_ERROR)
    .with("userNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const getClientUsersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("userNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
