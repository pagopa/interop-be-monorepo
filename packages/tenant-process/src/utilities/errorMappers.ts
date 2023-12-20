/* eslint-disable sonarjs/no-identical-functions */
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

export const getTenantByIdErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("tenantNotFound", () => 404)
    .otherwise(() => 500);

export const getTenantByExternalIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => 404)
    .otherwise(() => 500);

export const getTenantBySelfcareIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantBySelfcareIdNotFound", () => 404)
    .otherwise(() => 500);

export const updateTenantVerifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => 404)
    .with("verifiedAttributeNotFoundInTenant", () => 404)
    .with("expirationDateNotFoundInVerifier", () => 400)
    .with("expirationDateCannotBeInThePast", () => 400)
    .with("organizationNotFoundInVerifiers", () => 403)
    .otherwise(() => 500);
