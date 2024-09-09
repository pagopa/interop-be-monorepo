import { ApiError } from "pagopa-interop-models";

export const errorCodes = {
  clientAssertionValidationFailure: "0001",
  clientAssertionSignatureVerificationFailure: "0002",
  platformStateVerificationFailure: "0003",
};

export type ErrorCodes = keyof typeof errorCodes;

// TODO: make api problem?

export function clientAssertionValidationFailure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion validation failed`,
    code: "clientAssertionValidationFailure",
    title: "Client assertion validation failed",
  });
}

export function clientAssertionSignatureVerificationFailure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion signature verification failed`,
    code: "clientAssertionSignatureVerificationFailure",
    title: "Client assertion signature verification failed",
  });
}

export function platformStateVerificationFailure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Platform state verification failed`,
    code: "platformStateVerificationFailure",
    title: "Platform state verification failed",
  });
}
