import { makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);