/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

export const getDelegationByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("delegationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createProducerDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceNotFound",
      "delegationAlreadyExists",
      "tenantNotFound",
      "invalidDelegatorAndDelegateIds",
      "invalidExternalOriginId",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
