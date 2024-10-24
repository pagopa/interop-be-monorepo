import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  ApiError,
  ClientKindTokenStates,
  GeneratedTokenAuditDetails,
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
  // tokenSigningFailed: "0006",
  tokenGenerationStatesEntryNotFound: "0007",
  keyRetrievalFailed: "0008",
  invalidTokenClientKidPurposeEntry: "0009",
  keyTypeMismatch: "0010",
  unexpectedTokenGenerationStatesEntry: "0011",
  unexpectedTokenGenerationError: "0012",
  platformStateValidationFailed: "0013",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientAssertionRequestValidationFailed(
  request: authorizationServerApi.AccessTokenRequest
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion request validation failed for request: ${JSON.stringify(
      request
    )}`,
    code: "clientAssertionRequestValidationFailed",
    title: "Client assertion request validation failed",
  });
}

export function clientAssertionValidationFailed(
  clientAssertion: string,
  clientId: string | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion validation failed for clientAssertion: ${clientAssertion}, clientId: ${clientId}`,
    code: "clientAssertionValidationFailed",
    title: "Client assertion validation failed",
  });
}

export function clientAssertionSignatureValidationFailed(
  clientAssertion: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion signature validation failed for clientAssertion: ${clientAssertion}`,
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

export function fallbackAuditFailed(jti: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Fallback audit failed. Jti: ${jti}`,
    code: "fallbackAuditFailed",
    title: "Fallback audit failed",
  });
}

// export function tokenSigningFailed(
//   serializedToken: string
// ): ApiError<ErrorCodes> {
//   return new ApiError({
//     detail: `Token signing failed for token: ${serializedToken}`,
//     code: "tokenSigningFailed",
//     title: "Token signing failed",
//   });
// }

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

export function invalidTokenClientKidPurposeEntry(): ApiError<ErrorCodes> {
  return new ApiError({
    detail:
      "Missing data in client-kid-purpose entry from token-generation-states table",
    code: "invalidTokenClientKidPurposeEntry",
    title: "Invalid token client-kid-purpose entry",
  });
}

export function keyTypeMismatch(
  prefix: string,
  clientKind: ClientKindTokenStates
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Token-generation entry with prefix ${prefix} can't have client kind: ${clientKind}`,
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

export function unexpectedTokenGenerationError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Unexpected token generation error",
    code: "unexpectedTokenGenerationError",
    title: "Unexpected token generation error",
  });
}

export function platformStateValidationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Platform state validation failed",
    code: "platformStateValidationFailed",
    title: "Platform state validation failed",
  });
}
