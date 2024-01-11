import {
  AgreementState,
  ApiError,
  DescriptorState,
  makeApiProblemBuilder,
  AgreementState,
} from "pagopa-interop-models";

const errorCodes = {
  missingCertifiedAttributesError: "0001",
  agreementSubmissionFailed: "0002",
  agreementNotInExpectedState: "0003",
  descriptorNotInExpectedState: "0004",
  eServiceNotFound: "0005",
  contractAlreadyExists: "0006",
  operationNotAllowed: "0007",
  agreementActivationFailed: "0008",
  agreementNotFound: "0009",
  agreementAlreadyExists: "0010",
  noNewerDescriptor: "0011",
  publishedDescriptorNotFound: "0012",
  unexpectedVersionFormat: "0013",
  descriptorNotFound: "0014",
  stampNotFound: "0015",
  missingUserInfo: "0016",
  documentNotFound: "0017",
  documentsChangeNotAllowed: "0018",
  selfcareIdNotFound: "0019",
  tenantIdNotFound: "0020",
  notLatestEServiceDescriptor: "0021",
  attributeNotFound: "0022",
  invalidAttributeStructure: "0023",
  consumerWithNotValidEmail: "0024",
  agreementDocumentAlreadyExists: "0025",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function eServiceNotFound(eServiceId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function agreementNotFound(agreementId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function notLatestEServiceDescriptor(
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor with descriptorId: ${descriptorId} is not the latest descriptor`,
    code: "notLatestEServiceDescriptor",
    title: "Descriptor provided is not the latest descriptor",
  });
}

export function descriptorNotFound(
  eServiceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
    title: "Descriptor not found",
  });
}

export function descriptorNotInExpectedState(
  eServiceId: string,
  descriptorId: string,
  allowedStates: DescriptorState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} of EService ${eServiceId} has not status in ${allowedStates.join(
      ","
    )}`,
    code: "descriptorNotInExpectedState",
    title: "Descriptor not in expected state",
  });
}

export function missingCertifiedAttributesError(
  descriptorId: string,
  consumerId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Required certified attribute is missing. Descriptor ${descriptorId}, Consumer: ${consumerId}`,
    code: "missingCertifiedAttributesError",
    title: `Required certified attribute is missing`,
  });
}

export function agreementAlreadyExists(
  consumerId: string,
  eServiceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement already exists for Consumer = ${consumerId}, EService = ${eServiceId}`,
    code: "agreementAlreadyExists",
    title: "Agreement already exists",
  });
}

export function operationNotAllowed(requesterId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Operation not allowed by ${requesterId}`,
    code: "operationNotAllowed",
    title: "Operation not allowed",
  });
}

export function documentsChangeNotAllowed(
  state: AgreementState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The requested operation on consumer documents is not allowed on agreement with state ${state}`,
    code: "documentsChangeNotAllowed",
    title: "Operation not allowed on consumer documents",
  });
}

export function agreementDocumentAlreadyExists(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement document for ${agreementId} already exists`,
    code: "agreementDocumentAlreadyExists",
    title: "Agreement document already exists",
  });
}

export function agreementDocumentNotFound(
  documentId: string,
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document ${documentId} in agreement ${agreementId} not found`,
    code: "documentNotFound",
    title: "Document not found",
  });
}

export function agreementNotInExpectedState(
  agreementId: string,
  state: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not in expected state (current state: ${state})`,
    code: "agreementNotInExpectedState",
    title: "Agreement not in expected state",
  });
}

export function tenantIdNotFound(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantIdNotFound",
    title: "Tenant not found",
  });
}

export function agreementSubmissionFailed(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unable to activate agreement ${agreementId}. Please check if attributes requirements and suspension flags are satisfied`,
    code: "agreementSubmissionFailed",
    title: "Unable to activate agreement",
  });
}

export function contractAlreadyExists(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement document for ${agreementId} already exists`,
    code: "contractAlreadyExists",
    title: "Contract already exists",
  });
}

export function agreementActivationFailed(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    code: "agreementActivationFailed",
    title: "Unable to activate agreement",
    detail: `Unable to activate agreement ${agreementId}. Please check if attributes requirements and suspension flags are satisfied`,
  });
}

export function consumerWithNotValidEmail(
  agreementId: string,
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} has a consumer tenant ${tenantId} with no valid email`,
    code: "consumerWithNotValidEmail",
    title: "Agreement with invalid consumer email",
  });
}

export function agreementStampNotFound(stamp: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement stamp ${stamp} not found`,
    code: "stampNotFound",
    title: "Stamp not found",
  });
}

export function agreementMissingUserInfo(userId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Some mandatory info are missing for user ${userId}`,
    code: "missingUserInfo",
    title: "Some mandatory info are missing for user",
  });
}

export function agreementSelfcareIdNotFound(
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Selfcare id not found for tenant ${tenantId}`,
    code: "selfcareIdNotFound",
    title: "Selfcare id not found for tenant",
  });
}

export function publishedDescriptorNotFound(
  eserviceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Published descriptor not found in EService ${eserviceId}`,
    code: "publishedDescriptorNotFound",
    title: "Published descriptor not found",
  });
}

export function unexpectedVersionFormat(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version in not an Int for descriptor ${descriptorId} of EService ${eserviceId}`,
    code: "unexpectedVersionFormat",
    title: "Unexpected version format",
  });
}

export function noNewerDescriptor(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No newer descriptor in EService ${eserviceId} exists for upgrade. Current descriptor ${descriptorId}`,
    code: "noNewerDescriptor",
    title: "Agreement cannot be upgraded",
  });
}

export function documentChangeNotAllowed(
  state: AgreementState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The requested operation on consumer documents is not allowed on agreement with state ${state}`,
    code: "documentChangeNotAllowed",
    title: "Document change not allowed",
  });
}
