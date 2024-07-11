import { constants } from "http2";
import { ApiError } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes } from "../models/errors.js";

const { HTTP_STATUS_NOT_FOUND, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const getAgreementErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("invalidAgreementState", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;
