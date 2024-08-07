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
  organizationNotAllowedOnClient: "0002",
  userIdNotFound: "0003",
  keyNotFound: "0004",
  userNotAllowedOnClient: "0005",
  purposeNotFound: "0006",
  userWithoutSecurityPrivileges: "0007",
  userAlreadyAssigned: "0008",
  eserviceNotFound: "0009",
  noPurposeVersionsFoundInRequiredState: "0010",
  descriptorNotFound: "0011",
  noAgreementFoundInRequiredState: "0012",
  purposeAlreadyLinkedToClient: "0013",
  organizationNotAllowedOnPurpose: "0014",
  tooManyKeysPerClient: "0015",
  userNotFound: "0016",
  keyAlreadyExists: "0017",
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

export function userNotAllowedOnClient(
  userId: UserId,
  clientId: ClientId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is not allowed on client ${clientId}`,
    code: "userNotAllowedOnClient",
    title: "User not allowed on client",
  });
}

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function userWithoutSecurityPrivileges(
  consumerId: TenantId,
  requesterUserId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${requesterUserId} does not have security privileges for consumer ${consumerId}`,
    code: "userWithoutSecurityPrivileges",
    title: "User without security privileges",
  });
}

export function userAlreadyAssigned(
  clientId: ClientId,
  userId: UserId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} is already assigned to the client ${clientId}`,
    code: "userAlreadyAssigned",
    title: "User already assigned",
  });
}

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
  });
}

export function noPurposeVersionsFoundInRequiredState(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No versions in required state found in purpose ${purposeId}`,
    code: "noPurposeVersionsFoundInRequiredState",
    title: "No purpose versions found in required state",
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

export function noAgreementFoundInRequiredState(
  eserviceId: EServiceId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No agreement in required state found for eservice ${eserviceId} and consumer ${consumerId}`,
    code: "noAgreementFoundInRequiredState",
    title: "No Agreement found in required state",
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
