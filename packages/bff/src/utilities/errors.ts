import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  missingClaim: "9990",
  unknownTenantOrigin: "0011",
};

export type ErrorCodes = keyof typeof errorCodes;

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
