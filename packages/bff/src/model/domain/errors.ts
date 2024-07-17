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
