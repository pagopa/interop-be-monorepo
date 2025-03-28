import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as APIGatewayErrorCodes } from "../models/errors.js";

export type ErrorCodes = APIGatewayErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_CONFLICT,
} = constants;

export const getAgreementErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("agreementNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementsErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("producerAndConsumerParamMissing", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createCertifiedAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeAlreadyExists", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAttributeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getPurposeErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAgreementByPurposeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("purposeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with(
      "activeAgreementByEserviceAndConsumerNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getEserviceErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("eserviceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getClientErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("clientNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getJWKErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("keyNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getEserviceDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eserviceNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("eserviceDescriptorNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getOrganizationErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getOrganizationEservicesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("tenantByOriginNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("attributeByOriginNotFound", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const revokeTenantAttributeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with("tenantByOriginNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("tenantAttributeNotFound", () => HTTP_STATUS_BAD_REQUEST)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const upsertTenantErrorMapper = (error: ApiError<ErrorCodes>): number =>
  match(error.code)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .with(
      "tenantByOriginNotFound",
      "attributeByCodeNotFound",
      () => HTTP_STATUS_NOT_FOUND
    )
    .with("certifiedAttributeAlreadyAssigned", () => HTTP_STATUS_CONFLICT)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;
