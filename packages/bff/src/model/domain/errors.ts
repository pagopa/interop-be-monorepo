import { constants } from "node:http2";
import {
  ApiError,
  PurposeId,
  makeApiProblemBuilder,
  AttributeId,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  eserviceDescriptorNotFound: "0004",
  attributeNotExists: "0005",
  invalidEserviceRequester: "0006",
  missingClaim: "0007",
  tenantLoginNotAllowed: "0008",
  tokenVerificationFailed: "0009",
  invalidInterfaceContentTypeDetected: "0010",
  invalidInterfaceFileDetected: "0011",
  openapiVersionNotRecognized: "0012",
  interfaceExtractingInfoError: "0013",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export const emptyErrorMapper = (): number =>
  constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;

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
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in Eservice ${eserviceId}`,
    code: "eserviceDescriptorNotFound",
    title: "EService descriptor not found",
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

export function invalidInterfaceContentTypeDetected(
  eServiceId: string,
  contentType: string,
  technology: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The interface file for EService ${eServiceId} has a contentType ${contentType} not admitted for ${technology} technology`,
    code: "invalidInterfaceContentTypeDetected",
    title: "Invalid content type detected",
  });
}

export function invalidInterfaceFileDetected(
  eServiceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The interface file for EService ${eServiceId} is invalid`,
    code: "invalidInterfaceFileDetected",
    title: "Invalid interface file detected",
  });
}

export function openapiVersionNotRecognized(
  version: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `OpenAPI version not recognized - ${version}`,
    code: "openapiVersionNotRecognized",
    title: "OpenAPI version not recognized",
  });
}

export function interfaceExtractingInfoError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error extracting info from interface file`,
    code: "interfaceExtractingInfoError",
    title: "Error extracting info from interface file",
  });
}
