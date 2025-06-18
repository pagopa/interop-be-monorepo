import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  notificationNotFound: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function notificationNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Notification not found`,
    code: "notificationNotFound",
    title: "Notification not found",
  });
}
