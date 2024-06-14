import { makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  clientNotFound: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);
