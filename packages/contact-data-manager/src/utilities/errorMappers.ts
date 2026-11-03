import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";

import { ErrorCodes as LocalErrorCodes } from "../model/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

export const getContactErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("contactNotFound", () => constants.HTTP_STATUS_NOT_FOUND)
    .otherwise(() => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
