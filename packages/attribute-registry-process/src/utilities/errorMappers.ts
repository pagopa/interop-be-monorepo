/* eslint-disable sonarjs/no-identical-functions */
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

export const getAttributesByNameErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const getAttributeByOriginAndCodeErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const getAttributeByIdErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("attributeNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const createDeclaredAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("originNotCompliant", () => 403)
    .otherwise(() => 500);

export const createVerifiedAttributesErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("originNotCompliant", () => 403)
    .otherwise(() => 500);
