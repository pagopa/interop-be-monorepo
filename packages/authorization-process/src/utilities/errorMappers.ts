/* eslint-disable sonarjs/no-identical-functions */
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

export const createConsumerClientErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createApiClientErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientsErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code).otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientsWithKeysErrorMapper = getClientsErrorMapper;

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
  // eslint-disable-next-line sonarjs/no-identical-functions
): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    // .with("purposeNotFound", () => HTTP_STATUS_BAD_REQUEST)
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
    .with(
      "organizationNotAllowedOnClient",
      "userWithoutSecurityPrivileges",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
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

export const getClientKeysErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createKeysErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "tooManyKeysPerClient",
      "notAllowedPrivateKeyException",
      "invalidKey",
      "jwkDecodingError",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("keyAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .with(
      "organizationNotAllowedOnClient",
      "userWithoutSecurityPrivileges",
      "userNotFound",
      () => HTTP_STATUS_FORBIDDEN
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientKeyErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", "keyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("organizationNotAllowedOnClient", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientKeyWithClientErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("clientNotFound", "keyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
