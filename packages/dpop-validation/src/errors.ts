import { ApiError } from "pagopa-interop-models";

export const errorCodes = {
  unexpectedDPoPProofSignatureVerificationError: "0001",
  invalidDPoPProofFormat: "0002",
  unexpectedDPoPProofError: "0003",
  dpopJtiNotFound: "0004",
  dpopJtiAlreadyCached: "0005",
  dpopIatNotFound: "0006",
  dpopTypNotFound: "0007",
  invalidDPoPTyp: "0008",
  dpopJwkNotFound: "0009",
  dpopHtmNotFound: "0010",
  invalidDPoPHtm: "0011",
  dpopHtuNotFound: "0012",
  invalidDPoPHtu: "0013",
  dpopProofSignatureVerificationError: "0014",
  invalidDPoPJwt: "0015",
  dpopAlgorithmNotFound: "0016",
  dpopAlgorithmNotAllowed: "0017",
  dpopProofInvalidClaims: "0018",
  invalidDPoPSignature: "0019",
  expiredDPoPProof: "0020",
  notYetValidDPoPProof: "0021",
  multipleDPoPProofsError: "0022",
  dpopTokenBindingMismatch: "0023",
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

export function dpopJtiNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI not found in DPoP proof`,
    code: "dpopJtiNotFound",
    title: "DPoP JTI not found",
  });
}

export function dpopJtiAlreadyCached(jti: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI ${jti} already present in the DPoP proof cache table`,
    code: "dpopJtiAlreadyCached",
    title: "JTI already present in the DPoP proof cache table",
  });
}

export function dpopIatNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `IAT not found in DPoP proof`,
    code: "dpopIatNotFound",
    title: "DPoP IAT not found",
  });
}

export function dpopTypNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `TYP not found in DPoP proof`,
    code: "dpopTypNotFound",
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

export function dpopJwkNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JWK not found in DPoP proof header`,
    code: "dpopJwkNotFound",
    title: "DPoP JWK not found",
  });
}

export function dpopHtmNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `HTM not found in DPoP proof payload`,
    code: "dpopHtmNotFound",
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

export function dpopHtuNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `HTU not found in DPoP proof payload`,
    code: "dpopHtuNotFound",
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

export function invalidDPoPJwt(errorMessage: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid JWT format in DPoP proof signature validation. Reason: ${errorMessage}`,
    code: "invalidDPoPJwt",
    title: "Invalid JWT format",
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

export function dpopProofInvalidClaims(
  details: string,
  headerOrPayload: "header" | "payload"
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid claims in DPoP proof ${headerOrPayload}. Reason: ${JSON.stringify(
      JSON.parse(details)
    )}`,
    code: "dpopProofInvalidClaims",
    title: `Invalid claims in DPoP proof ${headerOrPayload}`,
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
  currentTime: number,
  durationSeconds: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Expired DPoP proof with iat ${iat}. Requested at: ${currentTime}. A DPoP proof is valid for ${durationSeconds} seconds.`,
    code: "expiredDPoPProof",
    title: "Expired DPoP proof",
  });
}

export function notYetValidDPoPProof(
  iat: number,
  currentTime: number,
  toleranceSeconds: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Not yet valid DPoP proof with iat ${iat}. Requested at: ${currentTime}. A DPoP proof iat has a tolerance of ${toleranceSeconds} seconds.`,
    code: "notYetValidDPoPProof",
    title: "Not yet valid DPoP proof",
  });
}

export function multipleDPoPProofsError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Multiple DPoP proofs found in the request headers",
    code: "multipleDPoPProofsError",
    title: "Multiple DPoP proofs found",
  });
}

export function dpopTokenBindingMismatch(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The DPoP proof public key hash does not match the access token binding (cnf))}`,
    code: "dpopTokenBindingMismatch",
    title: "DPoP Token Binding Mismatch",
  });
}
