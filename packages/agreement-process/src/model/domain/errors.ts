import { ApiError, DescriptorState } from "pagopa-interop-models";

export function eServiceNotFound(
  httpStatus: number,
  eServiceId: string
): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: "0007",
    httpStatus,
    title: "EService not found",
  });
}

export function agreementNotFound(agreementId: string): ApiError {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: "0009",
    httpStatus: 404,
    title: "Agreement not found",
  });
}

export function notLatestEServiceDescriptor(descriptorId: string): ApiError {
  return new ApiError({
    detail: `Descriptor with descriptorId: ${descriptorId} is not the latest descriptor`,
    code: "0021",
    httpStatus: 400,
    title: "Descriptor provided is not the latest descriptor",
  });
}

export function descriptorNotInExpectedState(
  eServiceId: string,
  descriptorId: string,
  allowedStates: DescriptorState[]
): ApiError {
  return new ApiError({
    detail: `Descriptor ${descriptorId} of EService ${eServiceId} has not status in ${allowedStates.join(
      ","
    )}`,
    code: "0004",
    httpStatus: 400,
    title: "Descriptor not in expected state",
  });
}

export function missingCertifiedAttributesError(
  descriptorId: string,
  consumerId: string
): ApiError {
  return new ApiError({
    detail: `Required certified attribute is missing. Descriptor ${descriptorId}, Consumer: ${consumerId}`,
    code: "0001",
    httpStatus: 400,
    title: `Required certified attribute is missing`,
  });
}

export function agreementAlreadyExists(
  consumerId: string,
  eServiceId: string
): ApiError {
  return new ApiError({
    detail: `Agreement already exists for Consumer = ${consumerId}, EService = ${eServiceId}`,
    code: "0011",
    httpStatus: 404,
    title: "Agreement already exists",
  });
}

export function operationNotAllowed(requesterId: string): ApiError {
  return new ApiError({
    detail: `Operation not allowed by ${requesterId}`,
    code: "0007",
    httpStatus: 400,
    title: "Operation not allowed",
  });
}

export function agreementNotInExpectedState(
  agreementId: string,
  state: string
): ApiError {
  return new ApiError({
    detail: `Agreement ${agreementId} not in expected state (current state: ${state})`,
    code: "0003",
    httpStatus: 400,
    title: "Agreement not in expected state",
  });
}

export function tenantIdNotFound(tenantId: string): ApiError {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "0020",
    httpStatus: 404,
    title: "Tenant not found",
  });
}
