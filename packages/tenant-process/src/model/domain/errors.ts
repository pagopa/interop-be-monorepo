import { logger } from "pagopa-interop-commons";
import {
  ApiError,
  AttributeId,
  EServiceId,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

const errorCodes = {
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
  registryAttributeIdNotFound: "0014",
  certifiedAttributeOriginIsNotCompliantWithCertifier: "0015",
  certifiedAttributeNotFoundInTenant: "0016",
  certifiedAttributeAlreadyAssigned: "0017",
  certifierNotFound: "0018",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(logger, errorCodes);

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

export function certifiedAttributeNotFoundInTenant(
  tenantId: TenantId,
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certified attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "certifiedAttributeNotFoundInTenant",
    title: "Certified attribute not found in tenant",
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

export function registryAttributeIdNotFound(
  origin: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${origin} not found in registry`,
    code: "registryAttributeIdNotFound",
    title: "Registry AttributeId Not Found",
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
