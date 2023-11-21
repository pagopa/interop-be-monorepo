import {
  ApiError,
  errorCodes as commonErrorCodes,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { errorCodes } from "../model/domain/errors.js";

export const createEServiceErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(errorCodes.eServiceDuplicate, () => 409)
    .otherwise(() => 500);

export const updateEServiceErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(errorCodes.eServiceDuplicate, () => 404)
    .with(errorCodes.eserviceCannotBeUpdatedOrDeleted, () => 400)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

export const deleteEServiceErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(errorCodes.eServiceNotFound, () => 404)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

export const documentCreateErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

export const documentUpdateDeleteErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDocumentNotFound,
      () => 404
    )
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

export const createDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(errorCodes.eServiceNotFound, () => 404)
    .with(errorCodes.draftDescriptorAlreadyExists, () => 400)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

// eslint-disable-next-line sonarjs/no-identical-functions
export const deleteDraftDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

export const updateDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(commonErrorCodes.operationForbidden, () => 403)
    .with(errorCodes.notValidDescriptor, () => 400)
    .otherwise(() => 500);

export const publishDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(errorCodes.eServiceDescriptorWithoutInterface, () => 400)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

export const suspendDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(errorCodes.notValidDescriptor, () => 400)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

// eslint-disable-next-line sonarjs/no-identical-functions
export const activateDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(errorCodes.notValidDescriptor, () => 400)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

// eslint-disable-next-line sonarjs/no-identical-functions
export const cloneEServiceByDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);

// eslint-disable-next-line sonarjs/no-identical-functions
export const archiveDescriptorErrorMapper = (error: ApiError): number =>
  match(error.code)
    .with(
      errorCodes.eServiceNotFound,
      errorCodes.eServiceDescriptorNotFound,
      () => 404
    )
    .with(errorCodes.notValidDescriptor, () => 400)
    .with(commonErrorCodes.operationForbidden, () => 403)
    .otherwise(() => 500);
