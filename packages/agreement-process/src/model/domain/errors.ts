import { ApiError, DescriptorState } from "pagopa-interop-models";

export const errorCodes = {
  missingCertifiedAttributesError: "0001",
  agreementSubmissionFailed: "0002",
  agreementNotInExpectedState: "0003",
  descriptorNotInExpectedState: "0004",
  operationNotAllowed: "0005",
  eServiceNotFound: "0007",
  agreementNotFound: "0009",
  agreementAlreadyExists: "0011",
  agreementDescriptorNotFound: "0014",
  agreementStampNotFound: "0015",
  agreementMissingUserInfo: "0016",
  agreementSelfcareIdNotFound: "0019",
  tenantIdNotFound: "0020",
  notLatestEServiceDescriptor: "0021",
  consumerWithNotValidEmail: "0024",
};

export function eServiceNotFound(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: errorCodes.eServiceNotFound,
    title: "EService not found",
  });
}

export function agreementNotFound(agreementId: string): ApiError {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: errorCodes.agreementNotFound,
    title: "Agreement not found",
  });
}

export function notLatestEServiceDescriptor(descriptorId: string): ApiError {
  return new ApiError({
    detail: `Descriptor with descriptorId: ${descriptorId} is not the latest descriptor`,
    code: errorCodes.notLatestEServiceDescriptor,
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
    code: errorCodes.descriptorNotInExpectedState,
    title: "Descriptor not in expected state",
  });
}

export function missingCertifiedAttributesError(
  descriptorId: string,
  consumerId: string
): ApiError {
  return new ApiError({
    detail: `Required certified attribute is missing. Descriptor ${descriptorId}, Consumer: ${consumerId}`,
    code: errorCodes.missingCertifiedAttributesError,
    title: `Required certified attribute is missing`,
  });
}

export function agreementAlreadyExists(
  consumerId: string,
  eServiceId: string
): ApiError {
  return new ApiError({
    detail: `Agreement already exists for Consumer = ${consumerId}, EService = ${eServiceId}`,
    code: errorCodes.agreementAlreadyExists,
    title: "Agreement already exists",
  });
}

export function operationNotAllowed(requesterId: string): ApiError {
  return new ApiError({
    detail: `Operation not allowed by ${requesterId}`,
    code: errorCodes.operationNotAllowed,
    title: "Operation not allowed",
  });
}

export function agreementNotInExpectedState(
  agreementId: string,
  state: string
): ApiError {
  return new ApiError({
    detail: `Agreement ${agreementId} not in expected state (current state: ${state})`,
    code: errorCodes.agreementNotInExpectedState,
    title: "Agreement not in expected state",
  });
}

export function tenantIdNotFound(tenantId: string): ApiError {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: errorCodes.tenantIdNotFound,
    title: "Tenant not found",
  });
}

export function agreementSubmissionFailed(agreementId: string): ApiError {
  return new ApiError({
    detail: `Unable to activate agreement ${agreementId}. Please check if attributes requirements and suspension flags are satisfied`,
    code: errorCodes.agreementSubmissionFailed,
    title: "Unable to activate agreement",
  });
}

export function consumerWithNotValidEmail(
  agreementId: string,
  tenantId: string
): ApiError {
  return new ApiError({
    detail: `Agreement ${agreementId} has a consumer tenant ${tenantId} with no valid email`,
    code: errorCodes.consumerWithNotValidEmail,
    title: "Agreement with invalid consumer email",
  });
}

export function agreementStampNotFound(stamp: string): ApiError {
  return new ApiError({
    detail: `Agreement stamp ${stamp} not found`,
    code: errorCodes.agreementStampNotFound,
    title: "Stamp not found",
  });
}

export function agreementMissingUserInfo(userId: string): ApiError {
  return new ApiError({
    detail: `Some mandatory info are missing for user ${userId}`,
    code: errorCodes.agreementMissingUserInfo,
    title: "Some mandatory info are missing for user",
  });
}

export function agreementSelfcareIdNotFound(tenantId: string): ApiError {
  return new ApiError({
    detail: `Selfcare id not found for tenant ${tenantId}`,
    code: errorCodes.agreementSelfcareIdNotFound,
    title: "Selfcare id not found for tenant",
  });
}

export function agreementDescriptorNotFound(
  eserviceId: string,
  descriptorId: string
): ApiError {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: errorCodes.agreementDescriptorNotFound,
    title: "Descriptor not found",
  });
}

export function agreementSubmitOperationNotAllowed(
  requesterId: string
): ApiError {
  return new ApiError({
    detail: `Operation not allowed by ${requesterId}`,
    code: errorCodes.agreementSubmitOperationNotAllowed,
    title: "Operation not allowed",
  });
}
