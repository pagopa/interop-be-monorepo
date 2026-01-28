import {
  ApiError,
  ClientId,
  makeApiProblemBuilder,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";

const errorCodes = {
  clientAssertionRequestValidationFailed: "0001",
  clientAssertionValidationFailed: "0002",
  clientAssertionSignatureValidationFailed: "0003",
  kafkaAuditingFailed: "0004",
  fallbackAuditFailed: "0005",
  tokenGenerationStatesEntryNotFound: "0006",
  incompleteTokenGenerationStatesConsumerClient: "0007",
  platformStateValidationFailed: "0008",
  dpopProofValidationFailed: "0009",
  dpopProofSignatureValidationFailed: "0010",
  dpopProofJtiAlreadyUsed: "0012",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientAssertionRequestValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion request validation failed for request by client ${clientId} - ${details}`,
    code: "clientAssertionRequestValidationFailed",
    title: "Client assertion request validation failed",
  });
}

export function clientAssertionValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion validation failed for clientId: ${clientId} - ${details}`,
    code: "clientAssertionValidationFailed",
    title: "Client assertion validation failed",
  });
}

export function clientAssertionSignatureValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion signature validation failed for client ${clientId} - ${details}`,
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

export function incompleteTokenGenerationStatesConsumerClient(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing data in token-generation-states consumer client entry. Primary key: ${pk}`,
    code: "incompleteTokenGenerationStatesConsumerClient",
    title: "Incomplete token-generation-states consumer client entry",
  });
}

export function platformStateValidationFailed(
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Platform state validation failed - ${details}`,
    code: "platformStateValidationFailed",
    title: "Platform state validation failed",
  });
}

export function dpopProofValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof validation failed for clientId: ${clientId} - ${details}`,
    code: "dpopProofValidationFailed",
    title: "DPoP proof validation failed",
  });
}

export function dpopProofSignatureValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof signature validation failed for client ${clientId} - ${details}`,
    code: "dpopProofSignatureValidationFailed",
    title: "DPoP proof signature validation failed",
  });
}

export function dpopProofJtiAlreadyUsed(jti: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof JTI ${jti} already in cache`,
    code: "dpopProofJtiAlreadyUsed",
    title: "DPoP proof JTI already in cache",
  });
}
