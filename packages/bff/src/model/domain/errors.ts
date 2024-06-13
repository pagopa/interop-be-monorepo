import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  userNotFound: "0001",
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
