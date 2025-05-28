import { ApiError } from "pagopa-interop-models";

export const errorCodes = {
  unexpectedDPoPProofSignatureVerificationError: "0001",
  invalidDPoPProofFormat: "0002",
  unexpectedDPoPProofError: "0003",
  dpopJTINotFound: "0004",
  dpopJTIAlreadyCached: "0005",
  dpopIATNotFound: "0006",
  dpopTYPNotFound: "0007",
  invalidDPoPTyp: "0008",
  dpopJWKNotFound: "0009",
  dpopHTMNotFound: "0010",
  invalidDPoPHtm: "0011",
  dpopHTUNotFound: "0012",
  invalidDPoPHtu: "0013",
  dpopProofSignatureVerificationError: "0014",
  tokenExpiredError: "0015",
  jsonWebTokenError: "0016",
  notBeforeError: "0017",
  dpopAlgorithmNotFound: "0018",
  dpopAlgorithmNotAllowed: "0019",
  dpopAlgorithmsMismatch: "0020",
  dpopProofInvalidClaims: "0021",
  invalidDPoPSignature: "0022",
  expiredDPoPProof: "0023",
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

export function dpopProofSignatureVerificationError(
  errorMessage: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error verifying DPoP proof signature: Reason: ${errorMessage}`,
    code: "dpopProofSignatureVerificationError",
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

export function dpopJTINotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI not found in DPoP proof`,
    code: "dpopJTINotFound",
    title: "DPoP JTI not found",
  });
}

export function dpopJTIAlreadyCached(jti: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI ${jti} already present in the DPoP proof cache table`,
    code: "dpopJTIAlreadyCached",
    title: "JTI already present in the DPoP proof cache table",
  });
}

export function dpopIATNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `IAT not found in DPoP proof`,
    code: "dpopIATNotFound",
    title: "DPoP IAT not found",
  });
}

export function dpopTYPNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `TYP not found in DPoP proof`,
    code: "dpopTYPNotFound",
    title: "DPoP TYP not found",
  });
}

export function invalidDPoPTyp(typ: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid TYP ${typ} in DPoP proof header`,
    code: "invalidDPoPTyp",
    title: "Invalid TYP in DPoP proof",
  });
}

export function dpopJWKNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JWK not found in DPoP proof header`,
    code: "dpopJWKNotFound",
    title: "DPoP JWK not found",
  });
}

export function dpopHTMNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `HTM not found in DPoP proof payload`,
    code: "dpopHTMNotFound",
    title: "DPoP HTM not found",
  });
}

export function invalidDPoPHtm(htm: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid HTM ${htm} in DPoP proof payload`,
    code: "invalidDPoPHtm",
    title: "Invalid HTM in DPoP proof",
  });
}

export function dpopHTUNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `HTU not found in DPoP proof payload`,
    code: "dpopHTUNotFound",
    title: "DPoP HTU not found",
  });
}

export function invalidDPoPHtu(htu: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid HTU ${htu} in DPoP proof payload`,
    code: "invalidDPoPHtu",
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

export function dpopAlgorithmNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "ALG not found in DPoP proof",
    code: "dpopAlgorithmNotFound",
    title: "DPoP ALG not found",
  });
}

export function dpopAlgorithmNotAllowed(
  algorithm: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Algorithm ${algorithm} is not allowed for the DPoP proof`,
    code: "dpopAlgorithmNotAllowed",
    title: "DPoP ALG not allowed",
  });
}

export function dpopAlgorithmsMismatch(
  alg: string,
  jwkAlg: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP algorithms mismatch. ALG: ${alg}. JWK.ALG: ${jwkAlg}`,
    code: "dpopAlgorithmsMismatch",
    title: "DPoP algorithms mismatch",
  });
}

export function dpopProofInvalidClaims(details: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof validation failure. Reason: ${details}`,
    code: "dpopProofInvalidClaims",
    title: "Invalid claims in header or payload",
  });
}

export function invalidDPoPSignature(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "DPoP proof signature is invalid",
    code: "invalidDPoPSignature",
    title: "Invalid DPoP signature",
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
