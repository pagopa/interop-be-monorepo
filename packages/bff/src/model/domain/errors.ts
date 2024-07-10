import {
  ApiError,
  PurposeId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  missingClaim: "9990",
  unknownTenantOrigin: "0011",
  invalidJwtClaim: "0000", // Not used, change it if needed for a more specific error
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

export function unknownTenantOrigin(selfcareId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `SelfcareID ${selfcareId} is not inside whitelist or related with IPA`,
    code: "unknownTenantOrigin",
    title: "Unknown tenant origin",
  });
}

export function invalidJwtClaim(message: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid JWT claims - ${message}`,
    code: "invalidJwtClaim",
    title: "Invalid JWT claim",
  });
}
