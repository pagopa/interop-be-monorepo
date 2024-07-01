import {
  ApiError,
  PurposeId,
  makeApiProblemBuilder,
  parseErrorMessage,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0001",
  privacyNoticeNotFoundInConfiguration: "0025",
  privacyNoticeNotFound: "0026",
  privacyNoticeVersionIsNotTheLatest: "0027",
  dynamoReadingError: "0028",
  selfcareEntityNotFilled: "0032",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function selfcareEntityNotFilled(entity: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Selfcare entity not filled for ${entity}`,
    code: "selfcareEntityNotFilled",
    title: "Selfcare Entity not filled",
  });
}

export function userNotFound(
  userId: string,
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found for institution ${selfcareId}`,
    code: "userNotFound",
    title: "User not found",
  });
}

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function dynamoReadingError(error: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while reading data from Dynamo -> ${parseErrorMessage(
      error
    )}`,
    code: "dynamoReadingError",
    title: "Dynamo reading error",
  });
}

export function privacyNoticeNotFoundInConfiguration(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found in configuration`,
    code: "privacyNoticeNotFoundInConfiguration",
    title: "Privacy Notice not found in configuration",
  });
}

export function privacyNoticeNotFound(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found`,
    code: "privacyNoticeNotFound",
    title: "Privacy Notice not found",
  });
}

export function privacyNoticeVersionIsNotTheLatest(
  versionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `PrivacyNotice version ${versionId} not found`,
    code: "privacyNoticeVersionIsNotTheLatest",
    title: "Privacy Notice version is not the latest",
  });
}
