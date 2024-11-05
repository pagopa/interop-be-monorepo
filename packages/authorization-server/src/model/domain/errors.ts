import {
  ApiError,
  ClientId,
  ClientKindTokenStates,
  makeApiProblemBuilder,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";

export const errorCodes = {
  clientAssertionRequestValidationFailed: "0001",
  clientAssertionValidationFailed: "0002",
  clientAssertionSignatureValidationFailed: "0003",
  kafkaAuditingFailed: "0004",
  fallbackAuditFailed: "0005",
  tokenGenerationStatesEntryNotFound: "0006",
  keyRetrievalFailed: "0007",
  invalidTokenClientKidPurposeEntry: "0008",
  keyTypeMismatch: "0009",
  unexpectedTokenGenerationStatesEntry: "0010",
  platformStateValidationFailed: "0011",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientAssertionRequestValidationFailed(
  clientId: string | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion request validation failed for request by client ${clientId}`,
    code: "clientAssertionRequestValidationFailed",
    title: "Client assertion request validation failed",
  });
}

export function clientAssertionValidationFailed(
  clientId: string | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion validation failed for clientId: ${clientId}`,
    code: "clientAssertionValidationFailed",
    title: "Client assertion validation failed",
  });
}

export function clientAssertionSignatureValidationFailed(
  clientId: string | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion signature validation failed for client ${clientId}`,
    code: "clientAssertionSignatureValidationFailed",
    title: "Client assertion signature validation failed",
  });
}

export function kafkaAuditingFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Kafka auditing failed ",
    code: "kafkaAuditingFailed",
    title: "Kafka auditing failed",
  });
}

export function fallbackAuditFailed(clientId: ClientId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Fallback audit failed for client ${clientId}`,
    code: "fallbackAuditFailed",
    title: "Fallback audit failed",
  });
}

export function tokenGenerationStatesEntryNotFound(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Entry with PK ${pk} not found in token-generation-states table`,
    code: "tokenGenerationStatesEntryNotFound",
    title: "token-generation-states entry not found",
  });
}

export function keyRetrievalFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Key retrieval failed",
    code: "keyRetrievalFailed",
    title: "Key retrieval failed",
  });
}

export function invalidTokenClientKidPurposeEntry(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing data in client-kid-purpose entry from token-generation-states table. Primary key: ${pk}`,
    code: "invalidTokenClientKidPurposeEntry",
    title: "Invalid token client-kid-purpose entry",
  });
}

export function keyTypeMismatch(
  pk:
    | TokenGenerationStatesClientKidPurposePK
    | TokenGenerationStatesClientKidPK,
  clientKind: ClientKindTokenStates
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Token-generation entry ${pk} can't have client kind: ${clientKind}`,
    code: "keyTypeMismatch",
    title: "Key type mismatch",
  });
}

export function unexpectedTokenGenerationStatesEntry(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Unexpected token-generation-states entry",
    code: "unexpectedTokenGenerationStatesEntry",
    title: "Unexpected token-generation-states entry",
  });
}

export function platformStateValidationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Platform state validation failed",
    code: "platformStateValidationFailed",
    title: "Platform state validation failed",
  });
}
