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
  tenantNotFoundBySelfcareId: "0006",
  operationForbidden: "0007",
  selfcareIdConflict: "0008",
  verifiedAttributeNotFoundInTenant: "0009",
  expirationDateCannotBeInThePast: "0010",
  organizationNotFoundInVerifiers: "0011",
  expirationDateNotFoundInVerifier: "0012",
  tenantIsNotACertifier: "0013",
  certifiedAttributeOriginIsNotCompliantWithCertifier: "0014",
  certifiedAttributeAlreadyAssigned: "0015",
  certifierNotFound: "0016",
  attributeVerificationNotAllowed: "0017",
  verifiedAttributeSelfVerification: "0018",
  attributeNotFoundInTenant: "0019",
  tenantNotFoundByExternalId: "0020",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function verifiedAttributeSelfVerification(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organizations are not allowed to verify own attributes`,
    code: "verifiedAttributeSelfVerification",
    title: "verified Attribute Self Verification",
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

export function tenantNotFoundByExternalId(
  origin: string,
  code: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with externalId ${origin}/${code} not found`,
    code: "tenantNotFoundByExternalId",
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
    title: "attribute Verification is Not Allowed",
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

export function tenantNotFoundBySelfcareId(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with selfcareId ${selfcareId} not found`,
    code: "tenantNotFoundBySelfcareId",
    title: "Tenant not found by selfcareId",
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
    title: "Tenant Is Not A Certifier",
  });
}

export function certifierNotFound(certifierId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certifier ${certifierId} not found`,
    code: "certifierNotFound",
    title: "Certifier Not Found",
  });
}

export function certifiedAttributeOriginIsNotCompliantWithCertifier(
  origin: string,
  organizationId: TenantId,
  tenantId: TenantId,
  certifierId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} not allowed to assign certified attributes to tenant ${tenantId} -> origin ${origin} , certifier ${certifierId}`,
    code: "certifiedAttributeOriginIsNotCompliantWithCertifier",
    title: "certified Attribute Origin Is Not Compliant With Certifier",
  });
}

export function certifiedAttributeAlreadyAssigned(
  attributeId: AttributeId,
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certified Attribute ${attributeId} already assigned to tenant ${organizationId}`,
    code: "certifiedAttributeAlreadyAssigned",
    title: "certified Attribute Already Assigned",
  });
}

export function attributeNotFoundInTenant(
  attributeId: AttributeId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "attributeNotFoundInTenant",
    title: "Attribute not found in tenant",
  });
}
