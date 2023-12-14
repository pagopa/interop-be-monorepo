/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR, // 500
  HTTP_STATUS_NOT_FOUND, // 404
} = constants;

export const getTenantByIdErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getTenantByExternalIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getTenantBySelfcareIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantBySelfcateIdNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
