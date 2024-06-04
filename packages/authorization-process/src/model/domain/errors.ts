import {
  ApiError,
  ClientId,
  PurposeId,
  TenantId,
  UserId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  clientNotFound: "0001",
  missingUserId: "0002",
  organizationNotAllowedOnClient: "0003",
  userIdNotFound: "0004",
  keyNotFound: "0005",
  purposeIdNotFound: "0005",
  securityUserNotFound: "0006",
  userAlreadyAssigned: "0007",
  tooManyKeysPerClient: "0008",
  userNotFound: "0009",
  notAllowedPrivateKeyException: "0010",
  keyAlreadyExists: "0011",
};

export function missingUserId(kid: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key ${kid} has not UserId`,
    code: "missingUserId",
    title: "Missing userId",
  });
}

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
    title: "OrganizationNotAllowedOnClient",
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

export function keyNotFound(
  keyId: string,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key ${keyId} not found in client ${clientId}`,
    code: "keyNotFound",
    title: "Key not found",
  });
}

export function purposeIdNotFound(
  purposeId: PurposeId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found in client ${clientId}`,
    code: "purposeIdNotFound",
    title: "Purpose id not found",
  });
}

export function securityUserNotFound(
  requesterUserId: UserId,
  userId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Security user not found for consumer ${requesterUserId} and user ${userId}`,
    code: "securityUserNotFound",
    title: "security User not found",
  });
}

export function userAlreadyAssigned(
  clientId: ClientId,
  userId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is already assigned to the client ${clientId}`,
    code: "userAlreadyAssigned",
    title: "user Already Assigned",
  });
}

export function tooManyKeysPerClient(
  clientId: ClientId,
  size: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `he number of the keys ${size} for the client ${clientId.toString} exceed maximun allowed`,
    code: "tooManyKeysPerClient",
    title: "too Many Keys Per Client",
  });
}

export function userNotFound(
  userId: UserId,
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found for selfcare institution ${selfcareId}`,
    code: "userNotFound",
    title: "User not found",
  });
}

export function notAllowedPrivateKeyException(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `This contains a private key!`,
    code: "notAllowedPrivateKeyException",
    title: "Not allowed private key exception",
  });
}

export function keyAlreadyExists(kid: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key with kid: ${kid} already exists: `,
    code: "keyAlreadyExists",
    title: "Key already exists",
  });
}
