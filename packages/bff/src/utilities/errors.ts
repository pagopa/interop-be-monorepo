import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  missingClaim: "9990",
  unknownTenantOrigin: "0011",
  samlNotValid: "0029",
  missingSelfcareId: "0004",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

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
