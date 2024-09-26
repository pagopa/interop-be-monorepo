import { ApiError, ClientKindTokenStates } from "pagopa-interop-models";

export const errorCodes = {
  clientAssertionValidationFailure: "0001",
  clientAssertionSignatureVerificationFailure: "0002",
  invalidAssertionType: "0003",
  invalidGrantType: "0004",
  invalidAudienceFormat: "0005",
  invalidAudience: "0006",
  invalidClientASsertionFormat: "0007",
  unexpectedClientAssertionPayload: "0008",
  jtiNotFound: "0009",
  issuedAtNotFound: "0010",
  expNotFound: "0011",
  issuerNotFound: "0012",
  subjectNotFound: "0013",
  invalidSubject: "0014",
  invalidPurposeIdClaimFormat: "0015",
  kidNotFound: "0016",
  invalidClientAssertionSignatureType: "0017",
  tokenExpiredError: "0018",
  jsonWebTokenError: "0019",
  notBeforeError: "0020",
  inactivePurpose: "0021",
  inactiveAgreement: "0022",
  inactiveEService: "0023",
  invalidClientIdFormat: "0024",
  invalidSubjectFormat: "0025",
  digestClaimNotFound: "0026",
  invalidDigestFormat: "0027",
  invalidHashLength: "0028",
  invalidHashAlgorithm: "0029",
  algorithmNotFound: "0030",
  algorithmNotAllowed: "0031",
  purposeIdNotProvided: "0032",
  invalidKidFormat: "0033",
  unexpectedKeyType: "0034",
};

export type ErrorCodes = keyof typeof errorCodes;

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

export function unexpectedKeyType(
  clientKind: ClientKindTokenStates
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key doesn't correspond to client kind: ${clientKind}`,
    code: "unexpectedKeyType",
    title: "Unexpected key type",
  });
}
