import {
  ApiError,
  PurposeId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  invalidGrantType: "8002",
  invalidAssertionType: "8003",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function invalidGrantType(grantType: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Grant type not valid ${grantType}`,
    code: "invalidGrantType",
    title: "Invalid grant type",
  });
}

export function invalidAssertionType(
  assertionType: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Assertion type not valid ${assertionType}`,
    code: "invalidAssertionType",
    title: "Invalid assertion type",
  });
}
