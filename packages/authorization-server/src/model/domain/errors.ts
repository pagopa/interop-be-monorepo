import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  sampleError: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function sampleError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "sampleError",
    title: "sample",
  });
}
