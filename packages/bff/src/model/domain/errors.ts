import {
  ApiError,
  AttributeId,
  PurposeId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  agreementDescriptorNotFound: "0004",
  eserviceDescriptorNotFound: "0005",
  attributeNotExists: "0006",
  invalidEserviceRequester: "0007",
  missingClaim: "0008",
  tenantLoginNotAllowed: "0009",
  tokenVerificationFailed: "0010",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function selfcareEntityNotFilled(
  className: string,
  field: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Selfcare entity ${className} with field ${field} not filled`,
    code: "selfcareEntityNotFilled",
    title: "Selfcare Entity not filled",
  });
}

export function userNotFound(
  userId: string,
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found for institution ${selfcareId}`,
    code: "userNotFound",
    title: "User not found",
  });
}

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function agreementDescriptorNotFound(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor of agreement ${agreementId} not found`,
    code: "agreementDescriptorNotFound",
    title: "Agreement descriptor not found",
  });
}

export function invalidEServiceRequester(
  eServiceId: string,
  requesterId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} does not belong to producer ${requesterId}`,
    code: "invalidEserviceRequester",
    title: `Invalid eservice requester`,
  });
}

export function eserviceDescriptorNotFound(
  eServiceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in Eservice ${eServiceId}`,
    code: "eserviceDescriptorNotFound",
    title: `Descriptor not found`,
  });
}

export function attributeNotExists(id: AttributeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${id} does not exist in the attribute registry`,
    code: "attributeNotExists",
    title: "Attribute not exists",
  });
}

export function missingClaim(claimName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Claim ${claimName} has not been passed`,
    code: "missingClaim",
    title: "Claim not found",
  });
}

export function tenantLoginNotAllowed(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant origin is not allowed and SelfcareID ${selfcareId} does not belong to allow list`,
    code: "tenantLoginNotAllowed",
    title: "Tenant login not allowed",
  });
}

export function tokenVerificationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Token verification failed",
    code: "tokenVerificationFailed",
    title: "Token verification failed",
  });
}
