import { ApiError } from "pagopa-interop-models";

export const errorCodes = {
  unexpectedDPoPProofSignatureVerificationError: "0001",
  invalidDPoPProofFormat: "0002",
  unexpectedDPoPProofError: "0003",
  jtiNotFound: "0004",
  jtiAlreadyCached: "0005",
  iatNotFound: "0006",
  typNotFound: "0007",
  invalidTyp: "0008",
  jwkNotFound: "0009",
  htmNotFound: "0010",
  invalidHtm: "0011",
  htuNotFound: "0012",
  invalidHtu: "0013",
  dPoPProofSignatureVerificationError: "0014",
  tokenExpiredError: "0015",
  jsonWebTokenError: "0016",
  notBeforeError: "0017",
  algorithmNotFound: "0018",
  algorithmNotAllowed: "0019",
  dPoPProofInvalidClaims: "0020",
  invalidSignature: "0021",
  expiredDPoPProof: "0022",
};

export type ErrorCodes = keyof typeof errorCodes;

export function unexpectedDPoPProofSignatureVerificationError(
  message: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected DPoP proof signature verification error: ${message}`,
    code: "unexpectedDPoPProofSignatureVerificationError",
    title: "Unexpected DPoP proof signature verification error",
  });
}

export function dPoPProofSignatureVerificationError(
  errorMessage: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error verifying DPoP proof signature: Reason: ${errorMessage}`,
    code: "dPoPProofSignatureVerificationError",
    title: "DPoP proof signature verification error",
  });
}

export function invalidDPoPProofFormat(message: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for DPoP proof: ${message}`,
    code: "invalidDPoPProofFormat",
    title: "Invalid format for DPoP proof",
  });
}

export function unexpectedDPoPProofError(
  message: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected DPoP proof error: ${message}`,
    code: "unexpectedDPoPProofError",
    title: "Unexpected DPoP proof error",
  });
}

export function jtiNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI not found in DPoP proof`,
    code: "jtiNotFound",
    title: "JTI not found",
  });
}

export function jtiAlreadyCached(jti: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI ${jti} already present in the DPoP proof cache table`,
    code: "jtiAlreadyCached",
    title: "JTI already present in the DPoP proof cache table",
  });
}

export function iatNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `IAT not found in DPoP proof`,
    code: "iatNotFound",
    title: "IAT not found",
  });
}

export function typNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `TYP not found in DPoP proof`,
    code: "typNotFound",
    title: "TYP not found",
  });
}

export function invalidTyp(typ: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid TYP ${typ} in DPoP proof header`,
    code: "invalidTyp",
    title: "Invalid TYP in DPoP proof",
  });
}

export function jwkNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JWK not found in DPoP proof header`,
    code: "jwkNotFound",
    title: "JWK not found",
  });
}

export function htmNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `HTM not found in DPoP proof payload`,
    code: "htmNotFound",
    title: "HTM not found",
  });
}

export function invalidHtm(htm: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid HTM ${htm} in DPoP proof payload`,
    code: "invalidHtm",
    title: "Invalid HTM in DPoP proof",
  });
}

export function htuNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `HTU not found in DPoP proof payload`,
    code: "htuNotFound",
    title: "HTU not found",
  });
}

export function invalidHtu(htu: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid HTU ${htu} in DPoP proof payload`,
    code: "invalidHtu",
    title: "Invalid HTU in DPoP proof",
  });
}

export function tokenExpiredError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Token expired in DPoP proof signature validation",
    code: "tokenExpiredError",
    title: "Token expired",
  });
}

export function jsonWebTokenError(errorMessage: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid JWT format in DPoP proof signature validation. Reason: ${errorMessage}`,
    code: "jsonWebTokenError",
    title: "Invalid JWT format",
  });
}

export function notBeforeError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail:
      "Current time is before not before time in DPoP proof signature validation",
    code: "notBeforeError",
    title: "Current time is before not before time",
  });
}

export function algorithmNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "ALG not found in DPoP proof",
    code: "algorithmNotFound",
    title: "ALG not found",
  });
}

export function algorithmNotAllowed(algorithm: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Algorithm ${algorithm} is not allowed for the DPoP proof`,
    code: "algorithmNotAllowed",
    title: "ALG not allowed",
  });
}

export function dPoPProofInvalidClaims(details: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof validation failure. Reason: ${details}`,
    code: "dPoPProofInvalidClaims",
    title: "Invalid claims in header or payload",
  });
}

export function invalidSignature(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "DPoP proof signature is invalid",
    code: "invalidSignature",
    title: "Invalid signature",
  });
}

export function expiredDPoPProof(
  iat: number,
  currentTime: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Expired DPoP proof with iat ${iat}. Requested at: ${currentTime}`,
    code: "expiredDPoPProof",
    title: "Expired DPoP proof",
  });
}
