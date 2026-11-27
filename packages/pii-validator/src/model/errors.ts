import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  detectionFailed: "0002",
} as const;

type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, {
  forceGenericProblemOn500: true,
});

export function detectionFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "detectionFailed",
    title: "Detection failed",
    detail: "PII detection failed",
  });
}

export function invalidRequestBody(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "detectionFailed",
    title: "Invalid request body",
    detail: "Invalid JSON request body",
  });
}
