import { attributeRegistryErrorCodes } from "pagopa-interop-commons";
import {
  ApiError,
  AttributeId,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export type ErrorCodes = keyof typeof attributeRegistryErrorCodes;

export const makeApiProblem = makeApiProblemBuilder(
  attributeRegistryErrorCodes
);

export function attributeNotFound(identifier: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function attributeDuplicateByName(
  attributeName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `An attribute with name ${attributeName} already exists`,
    code: "attributeDuplicate",
    title: "Duplicate attribute name",
  });
}

export function attributeDuplicateByCodeOriginOrName(
  attributeName: string,
  attributeCode: string,
  attributeOrigin: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `An attribute with name ${attributeName} or code ${attributeCode} and origin ${attributeOrigin} already exists`,
    code: "attributeDuplicate",
    title: "Duplicate attribute name or code",
  });
}

export function originNotCompliant(origin: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester origin ${origin} is not allowed`,
    code: "originNotCompliant",
    title: "Origin is not compliant",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantIsNotACertifier(
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not a Certifier`,
    code: "tenantIsNotACertifier",
    title: "Tenant is not a certifier",
  });
}

export function attributeSubunitPropagationSelectionNotValid(): ApiError<ErrorCodes> {
  return new ApiError({
    detail:
      "The attribute selection must not contain duplicates nor more than one attribute",
    code: "attributeSubunitPropagationSelectionNotValid",
    title: "Subunit propagation selection not valid",
  });
}

export function attributeNotEligibleForSubunitPropagation(
  attributeId: AttributeId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} is not an eligible certified attribute of tenant ${tenantId} for subunit propagation`,
    code: "attributeNotEligibleForSubunitPropagation",
    title: "Attribute not eligible for subunit propagation",
  });
}
