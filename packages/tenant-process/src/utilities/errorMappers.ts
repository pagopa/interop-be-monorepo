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
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
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
    .with("tenantBySelfcareIdNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateTenantVerifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("verifiedAttributeNotFoundInTenant", () => HTTP_STATUS_NOT_FOUND)
    .with("expirationDateCannotBeInThePast", () => HTTP_STATUS_BAD_REQUEST)
    .with("organizationNotFoundInVerifiers", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateVerifiedAttributeExtensionDateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("verifiedAttributeNotFoundInTenant", () => 404)
    .with("organizationNotFoundInVerifiers", () => 403)
    .with("expirationDateNotFoundInVerifier", () => 400)
    .with("tenantNotFound", () => 404)
    .otherwise(() => 500);

export const selfcareUpsertTenantErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("selfcareIdConflict", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantIsNotACertifier", () => HTTP_STATUS_FORBIDDEN)
    .with("attributeNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with("attributeDoesNotBelongToCertifier", () => HTTP_STATUS_FORBIDDEN)
    .with("certifiedAttributeAlreadyAssigned", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addDeclaredAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const revokeCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", "attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "attributeDoesNotBelongToCertifier",
      "tenantIsNotACertifier",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("attributeAlreadyRevoked", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const revokeDeclaredAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("attributeNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getCertifiedAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantIsNotACertifier", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteTenantMailErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("mailNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
