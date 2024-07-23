import { constants } from "http2";
import {
  ApiError,
  PurposeId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  missingClaim: "0002",
  tenantLoginNotAllowed: "0003",
  tokenVerificationFailed: "0004",
  userNotFound: "0005",
  selfcareEntityNotFilled: "0006",
  unknownTenantOrigin: "0008",
  invalidJwtClaim: "0009",
  samlNotValid: "0010",
  missingSelfcareId: "0011",
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

export function samlNotValid(message: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while validating saml -> ${message}`,
    code: "samlNotValid",
    title: "SAML not valid",
  });
}

export function missingSelfcareId(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `SelfcareId in Tenant ${tenantId.toString()} not found`,
    code: "missingSelfcareId",
    title: "SelfcareId not found",
  });
}
