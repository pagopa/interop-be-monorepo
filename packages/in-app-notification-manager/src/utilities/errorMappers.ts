/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const { HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_NOT_FOUND } = constants;

export const markNotificationAsReadErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("notificationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteNotificationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("notificationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const markNotificationAsUnreadErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("notificationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
