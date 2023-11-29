/* eslint-disable sonarjs/no-identical-functions */
import { ApiError, CommonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

type ErrorCodes = LocalErrorCodes | CommonErrorCodes;

export const createEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceDuplicate", () => 409)
    .otherwise(() => 500);

export const updateEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceDuplicate", () => 404)
    .with("eserviceCannotBeUpdatedOrDeleted", () => 400)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const deleteEServiceErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const documentCreateErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const documentUpdateDeleteErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDocumentNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const createDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", () => 404)
    .with("draftDescriptorAlreadyExists", () => 400)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const deleteDraftDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const updateDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .with("notValidDescriptor", () => 400)
    .otherwise(() => 500);

export const publishDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("eServiceDescriptorWithoutInterface", () => 400)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const suspendDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("notValidDescriptor", () => 400)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const activateDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("notValidDescriptor", () => 400)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const cloneEServiceByDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);

export const archiveDescriptorErrorMapper = (
  error: ApiError<ErrorCodes>
): number =>
  match(error.code)
    .with("eServiceNotFound", "eServiceDescriptorNotFound", () => 404)
    .with("notValidDescriptor", () => 400)
    .with("operationForbidden", () => 403)
    .otherwise(() => 500);
