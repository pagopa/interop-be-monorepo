import {
  ApiError,
  PurposeId,
  makeApiProblemBuilder,
  AttributeId,
  parseErrorMessage,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  privacyNoticeNotFoundInConfiguration: "0004",
  privacyNoticeNotFound: "0005",
  privacyNoticeVersionIsNotTheLatest: "0006",
  dynamoReadingError: "0007",
  descriptorNotFound: "0008",
  attributeNotExists: "0009",
  invalidEserviceRequester: "0010",
  missingClaim: "00011",
  tenantLoginNotAllowed: "00012",
  tokenVerificationFailed: "00013",
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

export function dynamoReadingError(error: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while reading data from Dynamo -> ${parseErrorMessage(
      error
    )}`,
    code: "dynamoReadingError",
    title: "Dynamo reading error",
  });
}

export function privacyNoticeNotFoundInConfiguration(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found in configuration`,
    code: "privacyNoticeNotFoundInConfiguration",
    title: "Privacy Notice not found in configuration",
  });
}

export function privacyNoticeNotFound(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found`,
    code: "privacyNoticeNotFound",
    title: "Privacy Notice not found",
  });
}

export function privacyNoticeVersionIsNotTheLatest(
  versionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `PrivacyNotice version ${versionId} not found`,
    code: "privacyNoticeVersionIsNotTheLatest",
    title: "Privacy Notice version is not the latest",
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
    code: "descriptorNotFound",
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
