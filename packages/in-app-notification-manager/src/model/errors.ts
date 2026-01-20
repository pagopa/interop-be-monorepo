import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  notificationNotFound: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function notificationNotFound(
  notificationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Notification ${notificationId} not found`,
    code: "notificationNotFound",
    title: "Notification not found",
  });
}
