import { ApiError, ItemState } from "pagopa-interop-models";

export const errorCodes = {
  unexpectedClientAssertionSignatureVerificationError: "0001",
  invalidAssertionType: "0002",
  invalidGrantType: "0003",
  invalidAudience: "0004",
  audienceNotFound: "0005",
  invalidClientAssertionFormat: "0006",
  unexpectedClientAssertionPayload: "0007",
  jtiNotFound: "0008",
  issuedAtNotFound: "0009",
  expNotFound: "0010",
  issuerNotFound: "0011",
  subjectNotFound: "0012",
  invalidSubject: "0013",
  invalidPurposeIdClaimFormat: "0014",
  kidNotFound: "0015",
  clientAssertionSignatureVerificationError: "0016",
  tokenExpiredError: "0017",
  jsonWebTokenError: "0018",
  notBeforeError: "0019",
  invalidPurposeState: "0020",
  invalidAgreementState: "0021",
  invalidEServiceState: "0022",
  invalidClientIdFormat: "0023",
  invalidSubjectFormat: "0024",
  invalidDigestClaim: "0025",
  invalidHashLength: "0026",
  invalidHashAlgorithm: "0027",
  algorithmNotFound: "0028",
  algorithmNotAllowed: "0029",
  purposeIdNotProvided: "0030",
  invalidKidFormat: "0031",
  clientAssertionInvalidClaims: "0032",
  invalidSignature: "0033",
};

export type ErrorCodes = keyof typeof errorCodes;

export function unexpectedClientAssertionSignatureVerificationError(
  message: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected client assertion signature verification error: ${message}`,
    code: "unexpectedClientAssertionSignatureVerificationError",
    title: "Unexpected client assertion signature verification error",
  });
}

export function clientAssertionSignatureVerificationError(
  errorMessage: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error verifying client assertion signature: Reason: ${errorMessage}`,
    code: "clientAssertionSignatureVerificationError",
    title: "Client assertion signature verification error",
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

export function invalidAudience(
  aud: string | string[] | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected client assertion audience: ${aud}`,
    code: "invalidAudience",
    title: "Invalid audience",
  });
}

export function audienceNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Audience not found in client assertion",
    code: "audienceNotFound",
    title: "Audience not found",
  });
}

export function invalidClientAssertionFormat(
  message: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion: ${message}`,
    code: "invalidClientAssertionFormat",
    title: "Invalid format for Client assertion",
  });
}

export function unexpectedClientAssertionPayload(
  message: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected client assertion payload: ${message}`,
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

export function invalidPurposeState(
  purposeState: ItemState | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose state is: ${purposeState}`,
    code: "invalidPurposeState",
    title: "Purpose is not active",
  });
}

export function invalidEServiceState(
  eserviceState: ItemState | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `E-Service state is: ${eserviceState}`,
    code: "invalidEServiceState",
    title: "E-Service is not active",
  });
}

export function invalidAgreementState(
  agreementState: ItemState | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement state is: ${agreementState}`,
    code: "invalidAgreementState",
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

export function invalidDigestClaim(message: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid digest claim. Reason: ${message}`,
    code: "invalidDigestClaim",
    title: "Invalid digest claim",
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

export function clientAssertionInvalidClaims(
  details: string,
  headerOrPayload: "header" | "payload"
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid claims in client assertion ${headerOrPayload}. Reason: ${JSON.stringify(
      JSON.parse(details)
    )}`,
    code: "clientAssertionInvalidClaims",
    title: `Invalid claims in client assertion ${headerOrPayload}`,
  });
}

export function invalidSignature(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Client assertion signature is invalid",
    code: "invalidSignature",
    title: "Invalid signature",
  });
}
