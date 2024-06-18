import {
  ApiError,
  ClientId,
  DescriptorId,
  EServiceId,
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
  eserviceNotFound: "0008",
  purposeNotFound: "0009",
  noVersionsFoundInPurpose: "0010",
  descriptorNotFound: "0011",
  agreementNotFound: "0012",
  purposeAlreadyLinkedToClient: "0013",
  organizationNotAllowedOnPurpose: "0014",
  tooManyKeysPerClient: "0015",
  userNotFound: "0016",
  keyAlreadyExists: "0018",
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

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
  });
}

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function noVersionsFoundInPurpose(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No versions found in purpose ${purposeId}`,
    code: "noVersionsFoundInPurpose",
    title: "No versions found in purpose",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: "descriptorNotFound",
    title: "Descriptor not found",
  });
}

export function agreementNotFound(
  eserviceId: EServiceId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement not found for eservice ${eserviceId} and consumer ${consumerId}`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function purposeAlreadyLinkedToClient(
  purposeId: PurposeId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} is already linked to client ${clientId}`,
    code: "purposeAlreadyLinkedToClient",
    title: "Purpose already linked to client",
  });
}

export function organizationNotAllowedOnPurpose(
  organizationId: TenantId,
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed on purpose ${purposeId}`,
    code: "organizationNotAllowedOnPurpose",
    title: "Organization not allowed on purpose",
  });
}

export function tooManyKeysPerClient(
  clientId: ClientId,
  size: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Keys count (${size}) for the client ${clientId} exceed maximum allowed value`,
    code: "tooManyKeysPerClient",
    title: "Too many Keys per client",
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

export function keyAlreadyExists(kid: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key with kid ${kid} already exists `,
    code: "keyAlreadyExists",
    title: "Key already exists",
  });
}
