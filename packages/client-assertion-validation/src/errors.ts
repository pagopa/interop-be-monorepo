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
  invalidClientIdFormat: "0025",
  invalidSubjectFormat: "0026",
  digestClaimNotFound: "0027",
  invalidDigestFormat: "0028",
  invalidHashLength: "0029",
  invalidHashAlgorithm: "0030",
  algorithmNotFound: "0031",
  algorithmNotAllowed: "0032",
  purposeIdNotProvided: "0033",
  invalidKidFormat: "0034",
};

export type ErrorCodes = keyof typeof errorCodes;

// TODO: make api problem?

// TODO: missing errors:
// - InvalidClientIdFormat -> check on uuid
// - ClientAssertionParseFailed -> already handled in invalidClientAssertionFormat      X
// - ClientAssertionInvalidClaims -> should be covered by individual checks     ?
// - InvalidSubjectFormat -> check on uuid of subject claim
// - InvalidPurposeIdFormat -> check on uuid of purposeId claim (already covered by invalidPurposeIdClaimFormat?)
// - DigestClaimNotFound -> check if custom claim digest exists
// - InvalidDigestClaims -> check if digest has only {alg, value} keys      X we aren't discriminating from safeParse output
// - InvalidDigestFormat -> probably overlapping with previous. Check if digest is a JSON or a map        ? // TODO: check if map works with safeParse
// - InvalidHashLength -> check on the length of digest.value (digest is a custom claim)
// - InvalidHashAlgorithm -> check if digest.alg is sha256
// - AlgorithmNotFound -> check if header.alg is present
// - AlgorithmNotAllowed -> check if (header.alg === RS256)
// - PublicKeyParseFailed -> out of scope for this module     X
// - ClientAssertionVerificationError -> maybe too generic      X
// - InvalidClientAssertionSignature -> maybe already covered by existing cases     X
// - PurposeIdNotProvided -> based on entry type (Api client doesn't need purposeId)      // TODO: where to put this error?
// - PurposeNotFound -> related to previous, check if there is a purpose entry for that purposeId (in platform states)      needed in this package?
// - InvalidKidFormat -> Verify that kid does not contain special characters

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
    title: "Assertion type not valid",
  });
}

export function invalidGrantType(grantType: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Grant type not valid: ${grantType}`,
    code: "invalidGrantType",
    title: "Grant type not valid",
  });
}

export function invalidAudienceFormat(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Audience must be an array`,
    code: "invalidAudienceFormat",
    title: "Invalid audience format",
  });
}

export function invalidAudience(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Unexpected client assertion audience",
    code: "invalidAudience",
    title: "Invalid audience",
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
    detail: "Unexpected client assertion payload",
    code: "unexpectedClientAssertionPayload",
    title: "Invalid client assertion payload",
  });
}

export function jtiNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `JTI not found in client assertion`,
    code: "jtiNotFound",
    title: "JTI not found",
  });
}

export function issuedAtNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `IAT not found in client assertion`,
    code: "issuedAtNotFound",
    title: "IAT not found",
  });
}

export function expNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EXP not found in client assertion`,
    code: "expNotFound",
    title: "EXP not found",
  });
}

export function issuerNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Issuer not found in client assertion`,
    code: "issuerNotFound",
    title: "ISS not found",
  });
}

export function subjectNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Subject not found in client assertion",
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
    detail: `KID not found in client assertion`,
    code: "kidNotFound",
    title: "KID not found",
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
    title: "Token expired",
  });
}

export function jsonWebTokenError(errorMessage: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid JWT format in client assertion signature validation. Reason: ${errorMessage}`,
    code: "jsonWebTokenError",
    title: "Invalid JWT format",
  });
}

export function notBeforeError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail:
      "Current time is before not before time in client assertion signature validation",
    code: "notBeforeError",
    title: "Current time is before not before time",
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

export function invalidClientIdFormat(clientId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client id ${clientId} is not a valid UUID`,
    code: "invalidClientIdFormat",
    title: "Invalid client id format",
  });
}

export function invalidSubjectFormat(subject: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Subject claim ${subject} is not a valid UUID`,
    code: "invalidSubjectFormat",
    title: "Invalid subject format",
  });
}

export function digestClaimNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Digest claim not found`,
    code: "digestClaimNotFound",
    title: "Digest claim not found",
  });
}

export function invalidDigestFormat(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Invalid format for digest claim",
    code: "invalidDigestFormat",
    title: "Invalid digest format",
  });
}

export function invalidHashLength(alg: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid hash length for algorithm ${alg}`,
    code: "invalidHashLength",
    title: "Invalid hash length",
  });
}

export function invalidHashAlgorithm(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Invalid hash algorithm",
    code: "invalidHashAlgorithm",
    title: "Invalid hash algorithm",
  });
}

export function algorithmNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "ALG not found in client assertion",
    code: "algorithmNotFound",
    title: "ALG not found",
  });
}

export function algorithmNotAllowed(algorithm: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Algorithm ${algorithm} is not allowed`,
    code: "algorithmNotAllowed",
    title: "ALG not allowed",
  });
}

export function purposeIdNotProvided(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Claim purposeId does not exist in this assertion",
    code: "purposeIdNotProvided",
    title: "Purpose Id not provided",
  });
}

export function invalidKidFormat(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Unexpected format for kid",
    code: "invalidKidFormat",
    title: "Invalid KID format",
  });
}
