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
  userNotAllowedOnClient: "0006",
  purposeNotFound: "0007",
  userWithoutSecurityPrivileges: "0008",
  userAlreadyAssigned: "0009",
  eserviceNotFound: "0010",
  noPurposeVersionsFoundInRequiredState: "0011",
  descriptorNotFound: "0012",
  noAgreementFoundInRequiredState: "0013",
  purposeAlreadyLinkedToClient: "0014",
  organizationNotAllowedOnPurpose: "0015",
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
    detail: `User ${consumerId} does not have security privileges for consumer ${requesterUserId}`,
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
