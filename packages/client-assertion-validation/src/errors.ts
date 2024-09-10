import { ApiError } from "pagopa-interop-models";

export const errorCodes = {
  clientAssertionValidationFailure: "0001",
  clientAssertionSignatureVerificationFailure: "0002",
  platformStateVerificationFailure: "0003",
  invalidAssertionType: "0004",
  invalidGrantType: "0005",
  invalidAudienceFormat: "0006",
  invalidAudience: "0007",
  invalidClientASsertionFormat: "0008",
  unexpectedClientAssertionPayload: "0009",
  jtiNotFound: "0010",
  issuedAtNotFound: "0011",
  expNotFound: "0012",
  issuerNotFound: "0013",
  subjectNotFound: "0014",
  invalidSubject: "0015",
  invalidPurposeIdClaimFormat: "0016",
  kidNotFound: "0017",
  invalidClientAssertionSignatureType: "0018",
  tokenExpiredError: "0019",
  jsonWebTokenError: "0020",
  notBeforeError: "0021",
  inactivePurpose: "0022",
  inactiveAgreement: "0023",
  inactiveEService: "0024",
};

export type ErrorCodes = keyof typeof errorCodes;

// TODO: make api problem?

// TODO: missing errors:
// - InvalidClientIdFormat
// - ClientAssertionParseFailed
// - ClientAssertionInvalidClaims
// - InvalidSubjectFormat
// - InvalidPurposeIdFormat
// - InvalidHashLength
// - InvalidHashAlgorithm
// - AlgorithmNotFound
// - ExpirationNotFound
// - DigestClaimNotFound
// - InvalidDigestClaims
// - PublicKeyParseFailed
// - ClientAssertionVerificationError
// - InvalidClientAssertionSignature
// - PurposeIdNotProvided ????
// - PurposeNotFound
// - AlgorithmNotAllowed
// - InvalidAudienceFormat (for audience claim)
// - InvalidDigestFormat
// - InvalidKidFormat

export function clientAssertionValidationFailure(
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion validation failed: ${details}`,
    code: "clientAssertionValidationFailure",
    title: "Client assertion validation failed",
  });
}

export function clientAssertionSignatureVerificationFailure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion signature verification failed`,
    code: "clientAssertionSignatureVerificationFailure",
    title: "Client assertion signature verification failed",
  });
}

export function platformStateVerificationFailure(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Platform state verification failed`,
    code: "platformStateVerificationFailure",
    title: "Platform state verification failed",
  });
}

export function invalidAssertionType(
  assertionType: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Assertion type not valid: ${assertionType}`,
    code: "invalidAssertionType",
    title: "Client assertion validation failed",
  });
}

export function invalidGrantType(grantType: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Grant type not valid: ${grantType}`,
    code: "invalidGrantType",
    title: "Client assertion validation failed",
  });
}

export function invalidAudienceFormat(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Audience must be an array`,
    code: "invalidAudienceFormat",
    title: "Client assertion validation failed",
  });
}

export function invalidAudience(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected client assertion audience`,
    code: "invalidAudience",
    title: "Client assertion validation failed",
  });
}

export function invalidClientAssertionFormat(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "invalidClientASsertionFormat",
    title: "Invalid format for Client assertion",
  });
}

export function unexpectedClientAssertionPayload(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "unexpectedClientAssertionPayload",
    title: "Invalid format for Client assertion",
  });
}

export function jtiNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `jti not found in client assertion`,
    code: "jtiNotFound",
    title: "jti not found",
  });
}

export function issuedAtNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `iat not found in client assertion`,
    code: "issuedAtNotFound",
    title: "iat not found",
  });
}

export function expNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `exp not found in client assertion`,
    code: "expNotFound",
    title: "exp not found",
  });
}

export function issuerNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Issuer not found in client assertion`,
    code: "issuerNotFound",
    title: "iss not found",
  });
}

export function subjectNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Subject not found in client assertion`,
    code: "subjectNotFound",
    title: "Subject not found",
  });
}

export function invalidSubject(subject?: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Subject claim value ${subject} does not correspond to provided client_id parameter`,
    code: "invalidSubject",
    title: "Invalid subject",
  });
}

export function invalidPurposeIdClaimFormat(
  purposeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Id claim ${purposeId} is not a valid UUID`,
    code: "invalidPurposeIdClaimFormat",
    title: "Invalid purposeId claim format",
  });
}

export function kidNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `kid not found in client assertion`,
    code: "kidNotFound",
    title: "kid not found",
  });
}

export function invalidClientAssertionSignatureType(
  clientAssertionSignatureType: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client assertion signature's type not valid: ${clientAssertionSignatureType}`,
    code: "invalidClientAssertionSignatureType",
    title: "Token expired in client assertion signature validation",
  });
}

export function tokenExpiredError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Token expired in client assertion signature validation",
    code: "tokenExpiredError",
    title: "Token expired in client assertion signature validation",
  });
}

export function jsonWebTokenError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Invalid JWT format in client assertion signature validation",
    code: "jsonWebTokenError",
    title: "Invalid JWT format in client assertion signature validation",
  });
}

export function notBeforeError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail:
      "Current time is before not before time in client assertion signature validation",
    code: "notBeforeError",
    title:
      "Current time is before not before time in client assertion signature validation",
  });
}

export function inactivePurpose(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Purpose is not active",
    code: "inactivePurpose",
    title: "Purpose is not active",
  });
}

export function inactiveEService(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "E-Service is not active",
    code: "inactiveEService",
    title: "E-Service is not active",
  });
}

export function inactiveAgreement(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Agreement is not active",
    code: "inactiveAgreement",
    title: "Agreement is not active",
  });
}
