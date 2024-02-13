import {
  ApiError,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  attributeNotFound: "0001",
  attributeDuplicate: "0002",
  originNotCompliant: "0003",
  tenantNotFound: "0004",
  OrganizationIsNotACertifier: "0005",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function attributeNotFound(identifier: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function attributeDuplicate(
  attributeName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `ApiError during Attribute creation with name ${attributeName}`,
    code: "attributeDuplicate",
    title: "Duplicated attribute name",
  });
}

export function originNotCompliant(origin: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester has not origin ${origin}`,
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

export function OrganizationIsNotACertifier(
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not a Certifier`,
    code: "OrganizationIsNotACertifier",
    title: "Organization is not a certifier",
  });
}
