/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const { HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const temp = (error: ApiError<ErrorCodes>): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
