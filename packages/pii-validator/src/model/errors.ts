import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  detectionNotImplemented: "0001",
  detectionFailed: "0002",
} as const;

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, {
  forceGenericProblemOn500: true,
});

export function detectionNotImplemented(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "detectionNotImplemented",
    title: "Detection not implemented",
    detail: "PII detection is not implemented",
  });
}

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

export function isDetectionError(
  error: unknown
): error is ApiError<ErrorCodes> {
  return error instanceof ApiError && error.code === "detectionNotImplemented";
}
