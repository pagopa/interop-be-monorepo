import { notificationManagerErrorCodes } from "pagopa-interop-commons";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export type ErrorCodes = keyof typeof notificationManagerErrorCodes;

export const makeApiProblem = makeApiProblemBuilder(
  notificationManagerErrorCodes
);

export function notificationNotFound(
  notificationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Notification ${notificationId} not found`,
    code: "notificationNotFound",
    title: "Notification not found",
  });
}
