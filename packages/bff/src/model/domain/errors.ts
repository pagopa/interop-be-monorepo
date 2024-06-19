import {
  ApiError,
  DescriptorId,
  EServiceId,
  PurposeId,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  eServiceNotFound: "0002",
  tenantNotFound: "0003",
  agreementNotFound: "0004",
  eServiceDescriptorNotFound: "0005",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function agreementNotFound(consumerId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement of consumer ${consumerId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function eServiceDescriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in Eservice ${eserviceId}`,
    code: "eServiceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}
