import {
  ApiError,
  ClientKindTokenStates,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  clientAssertionRequestValidationFailed: "0001",
  clientAssertionValidationFailed: "0002",
  clientAssertionSignatureValidationFailed: "0003",
  kafkaAuditingFailed: "0004",
  fallbackAuditFailed: "0005",
  tokenSigningFailed: "0006",
  keyNotFound: "0007",
  keyRetrievalError: "0008",
  invalidPlatformStates: "0009",
  keyTypeMismatch: "0010",
  unexpectedTokenGenerationStatesEntry: "0011",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientAssertionRequestValidationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "clientAssertionRequestValidationFailed",
    title: "sample",
  });
}

export function clientAssertionValidationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "clientAssertionValidationFailed",
    title: "sample",
  });
}

export function clientAssertionSignatureValidationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "clientAssertionSignatureValidationFailed",
    title: "sample",
  });
}

export function kafkaAuditingFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "kafkaAuditingFailed",
    title: "sample",
  });
}

export function fallbackAuditFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "fallbackAuditFailed",
    title: "sample",
  });
}

export function tokenSigningFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "tokenSigningFailed",
    title: "sample",
  });
}

export function keyNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "keyNotFound",
    title: "sample",
  });
}

export function keyRetrievalError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "keyRetrievalError",
    title: "sample",
  });
}

export function invalidPlatformStates(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "invalidPlatformStates",
    title: "sample",
  });
}

export function keyTypeMismatch(
  prefix: string,
  clientKind: ClientKindTokenStates
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Token-generation entry with prefix ${prefix} can't have client kind: ${clientKind}`,
    code: "keyTypeMismatch",
    title: "sample",
  });
}

export function unexpectedTokenGenerationStatesEntry(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "sample",
    code: "unexpectedTokenGenerationStatesEntry",
    title: "sample",
  });
}
