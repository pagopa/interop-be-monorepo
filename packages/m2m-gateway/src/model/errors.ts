import { constants } from "http2";
import { makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, true);

export const emptyErrorMapper = (): number =>
  constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;
