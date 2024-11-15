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
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_CONFLICT,
} = constants;

export const getDelegationsErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

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
      "tenantNotFound",
      "delegatorAndDelegateSameId",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with(
      "tenantIsNotIPAError",
      "tenantNotAllowedToDelegation",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("delegationAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createConsumerDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "eserviceNotFound",
      "tenantNotFound",
      "delegatorAndDelegateSameId",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("tenantNotAllowedToDelegation", () => HTTP_STATUS_FORBIDDEN)
    .with("delegationAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const revokeDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("delegationNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("delegationNotRevokable", () => HTTP_STATUS_FORBIDDEN)
    .with("operationNotAllowOnDelegation", () => HTTP_STATUS_UNAUTHORIZED)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const approveDelegationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationRestrictedToDelegate", () => HTTP_STATUS_FORBIDDEN)
    .with("incorrectState", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const rejectDelegationErrorMapper = approveDelegationErrorMapper;