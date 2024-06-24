import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes } from "../model/domain/errors.js";

type BffErrorCodes = ErrorCodes | CommonErrorCodes;

const { HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_NOT_FOUND } = constants;

export const bffGetCatalogErrorMapper = (
  error: ApiError<BffErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const reversePurposeUpdateErrorMapper = (
  error: ApiError<BffErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
