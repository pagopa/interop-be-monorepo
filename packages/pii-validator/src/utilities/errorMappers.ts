import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";

import { ErrorCodes } from "../model/errors.js";

type PiiValidatorErrorCodes = ErrorCodes | CommonErrorCodes;

export const detectionErrorMapper = (
  error: ApiError<PiiValidatorErrorCodes>
): number =>
  match(error.code)
    .with(
      "detectionNotImplemented",
      () => constants.HTTP_STATUS_NOT_IMPLEMENTED
    )
    .otherwise(() => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const invalidRequestBodyErrorMapper = (): number =>
  constants.HTTP_STATUS_BAD_REQUEST;
