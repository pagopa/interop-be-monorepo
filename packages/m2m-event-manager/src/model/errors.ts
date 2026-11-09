import { makeApiProblemBuilder } from "pagopa-interop-models";

// eslint-disable-next-line interop/require-type-for-object
const errorCodes = {};

export const makeApiProblem = makeApiProblemBuilder(errorCodes);
