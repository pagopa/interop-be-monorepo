import { makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {};

export const makeApiProblem = makeApiProblemBuilder(errorCodes);
