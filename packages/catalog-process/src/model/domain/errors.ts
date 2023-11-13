import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  eServiceDescriptorNotFound: "0002",
  eServiceDocumentNotFound: "0003",
  notValidDescriptor: "0004",
  eServiceNotFound: "0007",
  draftDescriptorAlreadyExists: "0008",
  eserviceCannotBeUpdatedOrDeleted: "0009",
  eServiceDuplicate: "0010",
  operationForbidden: "9989",
};

const eserviceCannotBeUpdatedOrDeleted = {
  code: errorCodes.eserviceCannotBeUpdatedOrDeleted,
  httpStatus: 400,
  title: "EService cannot be updated or deleted",
};

export function eServiceNotFound(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: errorCodes.eServiceNotFound,
    httpStatus: 404,
    title: "EService not found",
  });
}

export function eServiceDuplicate(eServiceNameSeed: string): ApiError {
  return new ApiError({
    detail: `ApiError during EService creation with name ${eServiceNameSeed}`,
    code: errorCodes.eServiceDuplicate,
    httpStatus: 409,
    title: "Duplicated service name",
  });
}

export const operationForbidden = new ApiError({
  detail: `Insufficient privileges`,
  code: errorCodes.operationForbidden,
  httpStatus: 400,
  title: "Insufficient privileges",
});

export function eServiceCannotBeUpdated(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} contains valid descriptors and cannot be updated`,
    ...eserviceCannotBeUpdatedOrDeleted,
  });
}

export function eServiceCannotBeDeleted(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} contains descriptors and cannot be deleted`,
    ...eserviceCannotBeUpdatedOrDeleted,
  });
}

export function eServiceDescriptorNotFound(
  eServiceId: string,
  descriptorId: string
): ApiError {
  return new ApiError({
    detail: `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
    code: errorCodes.eServiceDescriptorNotFound,
    httpStatus: 404,
    title: "EService descriptor not found",
  });
}

export function eServiceDocumentNotFound(
  eServiceId: string,
  descriptorId: string,
  documentId: string
): ApiError {
  return new ApiError({
    detail: `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
    code: errorCodes.eServiceDocumentNotFound,
    httpStatus: 404,
    title: "EService document not found",
  });
}

export function notValidDescriptor(
  descriptorId: string,
  descriptorStatus: string
): ApiError {
  return new ApiError({
    detail: `Descriptor ${descriptorId} has a not valid status for this operation ${descriptorStatus}`,
    code: errorCodes.notValidDescriptor,
    httpStatus: 400,
    title: "Not valid descriptor",
  });
}

export function draftDescriptorAlreadyExists(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} already contains a draft descriptor`,
    code: errorCodes.draftDescriptorAlreadyExists,
    httpStatus: 400,
    title: "EService already contains a draft descriptor",
  });
}

export function invalidDescriptorVersion(details: string): ApiError {
  return new ApiError({
    detail: details,
    code: errorCodes.notValidDescriptor,
    httpStatus: 400,
    title: "Version is not a valid descriptor version",
  });
}
