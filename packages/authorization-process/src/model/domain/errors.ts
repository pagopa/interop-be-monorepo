import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  clientNotFound: "0001",
  missingUserId: "0002",
};

export function missingUserId(kid: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key ${kid} has not UserId`,
    code: "missingUserId",
    title: "Missing userId",
  });
}

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);
