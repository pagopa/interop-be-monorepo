import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_BAD_REQUEST,
} = constants;

export const getClientErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createClientErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createApiErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteClientErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeUserErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", "userIdNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteClientKeyByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", "keyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const removeClientPurposeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("purposeNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientUsersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addUserErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("userWithoutSecurityPrivileges", () => HTTP_STATUS_FORBIDDEN)
    .with("userAlreadyAssigned", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addClientPurposeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "clientNotFound",
      "purposeNotFound",

      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "noAgreementFoundInRequiredState",
      "noPurposeVersionsFoundInRequiredState",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("purposeAlreadyLinkedToClient", () => HTTP_STATUS_CONFLICT)
    .with(
      "organizationNotAllowedOnClient",
      "organizationNotAllowedOnPurpose",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

// eslint-disable-next-line sonarjs/no-identical-functions
export const getClientKeysErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
