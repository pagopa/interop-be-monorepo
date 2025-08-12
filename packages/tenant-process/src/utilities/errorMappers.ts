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
    .with("tenantNotFoundByExternalId", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getTenantBySelfcareIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFoundBySelfcareId", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateTenantVerifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("verifiedAttributeNotFoundInTenant", () => HTTP_STATUS_NOT_FOUND)
    .with("expirationDateCannotBeInThePast", () => HTTP_STATUS_BAD_REQUEST)
    .with("tenantNotFoundInVerifiers", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateVerifiedAttributeExtensionDateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "verifiedAttributeNotFoundInTenant",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("tenantNotFoundInVerifiers", () => HTTP_STATUS_FORBIDDEN)
    .with("expirationDateNotFoundInVerifier", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const selfcareUpsertTenantErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("selfcareIdConflict", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const internalAddCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("certifiedAttributeAlreadyAssigned", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const internalRevokeCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "attributeNotFoundInTenant",
      () => HTTP_STATUS_NOT_FOUND
    )
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
    .with(
      "tenantNotFound",
      "attributeNotFound",
      "delegationNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("operationRestrictedToDelegate", () => HTTP_STATUS_FORBIDDEN)
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

export const maintenanceTenantDeletedErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const maintenanceTenantUpdatedErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addVerifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("expirationDateCannotBeInThePast", () => HTTP_STATUS_BAD_REQUEST)
    .with(
      "tenantNotFound",
      "attributeNotFound",
      "agreementNotFound",
      "eServiceNotFound",
      "descriptorNotFoundInEservice",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "verifiedAttributeSelfVerificationNotAllowed",
      "attributeVerificationNotAllowed",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("verifiedAttributeAlreadyVerified", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const revokeVerifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("attributeNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eServiceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("descriptorNotFoundInEservice", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "verifiedAttributeSelfRevocationNotAllowed",
      "attributeRevocationNotAllowed",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("attributeAlreadyRevoked", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const deleteTenantMailErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("mailNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const addTenantMailErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("mailAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const internalUpsertTenantErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", "attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("certifiedAttributeAlreadyAssigned", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const m2mUpsertTenantErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "attributeNotFound",
      "tenantNotFoundByExternalId",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("certifiedAttributeAlreadyAssigned", () => HTTP_STATUS_CONFLICT)
    .with("tenantIsNotACertifier", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const maintenanceTenantPromotedToCertifierErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "tenantIsAlreadyACertifier",
      "certifierWithExistingAttributes",
      () => HTTP_STATUS_CONFLICT
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const m2mRevokeCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "tenantNotFoundByExternalId",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with(
      "attributeNotFound",
      "attributeNotFoundInTenant",
      () => HTTP_STATUS_BAD_REQUEST
    )
    .with("tenantIsNotACertifier", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const updateTenantDelegatedFeaturesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getTenantVerifiedAttributeVerifiersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "attributeNotFound",
      "attributeNotFoundInTenant",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getTenantVerifiedAttributeRevokersErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with(
      "tenantNotFound",
      "attributeNotFound",
      "attributeNotFoundInTenant",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
