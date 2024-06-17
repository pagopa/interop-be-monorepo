import {
  ApiError,
  ClientId,
  TenantId,
  UserId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  clientNotFound: "0001",
  missingUserId: "0002",
  organizationNotAllowedOnClient: "0003",
  userIdNotFound: "0004",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientNotFound(clientId: ClientId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client ${clientId} not found`,
    code: "clientNotFound",
    title: "Client not found",
  });
}

export function organizationNotAllowedOnClient(
  organizationId: TenantId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed on client ${clientId}`,
    code: "organizationNotAllowedOnClient",
    title: "Organization not allowed on client",
  });
}

export function userIdNotFound(
  userId: UserId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found in client ${clientId}`,
    code: "userIdNotFound",
    title: "User id not found",
  });
}
