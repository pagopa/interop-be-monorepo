import {
  ApiError,
  AttributeId,
  EServiceId,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  attributeNotFound: "0001",
  invalidAttributeStructure: "0002",
  tenantDuplicate: "0003",
  tenantNotFound: "0004",
  eServiceNotFound: "0005",
  tenantBySelfcareIdNotFound: "0006",
  operationForbidden: "0007",
  selfcareIdConflict: "0008",
  verifiedAttributeNotFoundInTenant: "0009",
  expirationDateCannotBeInThePast: "0010",
  organizationNotFoundInVerifiers: "0011",
  expirationDateNotFoundInVerifier: "0012",
  tenantIsNotACertifier: "0013",
  attributeDoesNotBelongToCertifier: "0014",
  certifiedAttributeAlreadyAssigned: "0015",
  attributeVerificationNotAllowed: "0016",
  verifiedAttributeSelfVerificationNotAllowed: "0017",
  mailNotFound: "0018",
  mailAlreadyExists: "0019",
  attributeAlreadyRevoked: "0020",
  attributeRevocationNotAllowed: "0021",
  verifiedAttributeSelfRevocationNotAllowed: "0022",
  tenantIsAlreadyACertifier: "0023",
  certifierIdAlreadyExistsInTenant: "0024",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function verifiedAttributeSelfVerificationNotAllowed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organizations are not allowed to verify own attributes`,
    code: "verifiedAttributeSelfVerificationNotAllowed",
    title: "Verified attribute self verification not allowed",
  });
}

export function verifiedAttributeSelfRevocationNotAllowed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organizations are not allowed to revoke own attributes`,
    code: "verifiedAttributeSelfRevocationNotAllowed",
    title: "Verified attribute self revocation not allowed",
  });
}

export function attributeNotFound(identifier: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function invalidAttributeStructure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid attribute structure`,
    code: "invalidAttributeStructure",
    title: "Invalid attribute structure",
  });
}

export function tenantDuplicate(teanantName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${teanantName} already exists`,
    code: "tenantDuplicate",
    title: "Duplicated tenant name",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantFromExternalIdNotFound(
  origin: string,
  code: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with externalId ${origin}/${code} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function verifiedAttributeNotFoundInTenant(
  tenantId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Verified attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "verifiedAttributeNotFoundInTenant",
    title: "Verified attribute not found in tenant",
  });
}

export function expirationDateCannotBeInThePast(
  date: Date
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Expiration date ${date} cannot be in the past`,
    code: "expirationDateCannotBeInThePast",
    title: "Expiration date cannot be in the past",
  });
}

export function attributeVerificationNotAllowed(
  consumerId: string,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization is not allowed to verify attribute ${attributeId} 
    for tenant ${consumerId}`,
    code: "attributeVerificationNotAllowed",
    title: "Attribute verification is not allowed",
  });
}

export function attributeRevocationNotAllowed(
  consumerId: string,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization is not allowed to revoke attribute ${attributeId} 
    for tenant ${consumerId}`,
    code: "attributeRevocationNotAllowed",
    title: "Attribute revocation is not allowed",
  });
}

export function organizationNotFoundInVerifiers(
  requesterId: string,
  tenantId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${requesterId} not found in verifier for Tenant ${tenantId} and attribute ${attributeId}`,
    code: "organizationNotFoundInVerifiers",
    title: "Organization not found in verifiers",
  });
}

export function tenantBySelfcareIdNotFound(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found`,
    code: "tenantBySelfcareIdNotFound",
    title: "Tenant with selfcareId not found",
  });
}

export function expirationDateNotFoundInVerifier(
  verifierId: string,
  attributeId: string,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `ExpirationDate not found in verifier ${verifierId} for Tenant ${tenantId} and attribute ${attributeId}`,
    code: "expirationDateNotFoundInVerifier",
    title: "ExpirationDate not found in verifier",
  });
}
export function selfcareIdConflict({
  tenantId,
  existingSelfcareId,
  newSelfcareId,
}: {
  tenantId: TenantId;
  existingSelfcareId: string;
  newSelfcareId: string;
}): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Conflict on Tenant SelfCareId update for tenant ${tenantId}: old value ${existingSelfcareId} - new value ${newSelfcareId}`,
    code: "selfcareIdConflict",
    title: "Selfcare id conflict",
  });
}

export function tenantIsNotACertifier(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} not allowed to assign attributes`,
    code: "tenantIsNotACertifier",
    title: "Tenant is not a certifier",
  });
}

export function attributeDoesNotBelongToCertifier(
  attributeId: AttributeId,
  organizationId: TenantId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} not allowed to assign certified attribute ${attributeId} to tenant ${tenantId}`,
    code: "attributeDoesNotBelongToCertifier",
    title: "Attribute does not belong to certifier",
  });
}

export function certifiedAttributeAlreadyAssigned(
  attributeId: AttributeId,
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certified Attribute ${attributeId} already assigned to tenant ${organizationId}`,
    code: "certifiedAttributeAlreadyAssigned",
    title: "Certified attribute already assigned",
  });
}

export function attributeAlreadyRevoked(
  tenantId: TenantId,
  organizationId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} has been already revoked for ${tenantId} by ${organizationId}`,
    code: "attributeAlreadyRevoked",
    title: "Attribute is already revoked",
  });
}
export function mailNotFound(mailId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `mail ${mailId} not found`,
    code: "mailNotFound",
    title: "Mail not found",
  });
}

export function mailAlreadyExists(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `mail already exists`,
    code: "mailAlreadyExists",
    title: "Mail already exists",
  });
}

export function tenantIsAlreadyACertifier(
  tenantId: TenantId,
  certifierId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${tenantId} is already a certifier with certifierId ${certifierId}`,
    code: "tenantIsAlreadyACertifier",
    title: "Tenant is already a certifier",
  });
}

export function certifierIdAlreadyExistsInTenant(
  certifierId: string,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `CertifierId ${certifierId} already exists in tenant ${tenantId}`,
    code: "certifierIdAlreadyExistsInTenant",
    title: "CertifierId already exists in tenant",
  });
}
