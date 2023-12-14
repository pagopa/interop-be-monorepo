/* eslint-disable sonarjs/no-identical-functions */
import { constants } from "http2";
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR, // 500
  HTTP_STATUS_FORBIDDEN, // 403
  HTTP_STATUS_NOT_FOUND, // 404
} = constants;

export const getAttributesByNameErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAttributeByOriginAndCodeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const getAttributeByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => HTTP_STATUS_NOT_FOUND)
    .with("operationForbidden", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createDeclaredAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("originNotCompliant", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createVerifiedAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("originNotCompliant", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createCertifiedAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("OrganizationIsNotACertifier", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export const createInternalCertifiedAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("OrganizationIsNotACertifier", () => HTTP_STATUS_FORBIDDEN)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);
