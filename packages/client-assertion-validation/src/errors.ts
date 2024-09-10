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
};

export type ErrorCodes = keyof typeof errorCodes;

// TODO: make api problem?

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
    detail: `Invalid format for Client assertion`,
    code: "jtiNotFound",
    title: "JTI not found in client assertion",
  });
}

export function issuedAtNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "issuedAtNotFound",
    title: "IAT not found in client assertion",
  });
}

export function expNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "expNotFound",
    title: "EXP not found in client assertion",
  });
}

export function issuerNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "issuerNotFound",
    title: "ISS not found in client assertion",
  });
}

export function subjectNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "subjectNotFound",
    title: "Subject not found in client assertion",
  });
}

export function invalidSubject(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "invalidSubject",
    title: "Subject not found in client assertion",
  });
}

export function invalidPurposeIdClaimFormat(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "invalidPurposeIdClaimFormat",
    title: "Subject not found in client assertion",
  });
}

export function kidNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid format for Client assertion`,
    code: "kidNotFound",
    title: "KID not found in client assertion",
  });
}

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
