import { ApiError } from "pagopa-interop-models";

const duplicateEserviceName = {
  code: "0010",
  httpStatus: 409,
  title: "Duplicated service name",
};

const eserviceCannotBeUpdatedOrDeleted = {
  code: "0009",
  httpStatus: 400,
  title: "EService cannot be updated or deleted",
};

const eserviceDescriptorNotFound = {
  code: "0002",
  httpStatus: 404,
  title: "EService descriptor not found",
};

const eserviceDocumentNotFound = {
  code: "0003",
  httpStatus: 404,
  title: "EService document not found",
}; // TODO: reorganize error codes

export function eServiceDuplicate(eServiceNameSeed: string): ApiError {
  return {
    detail: `ApiError during EService creation with name ${eServiceNameSeed}`,
    ...duplicateEserviceName,
  };
}

export const operationForbidden = {
  detail: `Insufficient privileges`,
  code: "9989",
  httpStatus: 400,
  title: "Insufficient privileges",
};

export function eServiceCannotBeUpdated(eServiceId: string): ApiError {
  return {
    detail: `EService ${eServiceId} contains valid descriptors and cannot be updated`,
    ...eserviceCannotBeUpdatedOrDeleted,
  };
}

export function eServiceCannotBeDeleted(eServiceId: string): ApiError {
  return {
    detail: `EService ${eServiceId} contains descriptors and cannot be deleted`,
    ...eserviceCannotBeUpdatedOrDeleted,
  };
}

export function eServiceDescriptorNotFound(
  eServiceId: string,
  descriptorId: string
): ApiError {
  return {
    detail: `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
    ...eserviceDescriptorNotFound,
  };
}

export function eServiceDocumentNotFound(
  eServiceId: string,
  descriptorId: string,
  documentId: string
): ApiError {
  return {
    detail: `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
    ...eserviceDocumentNotFound,
  };
}

export function notValidDescriptor(
  descriptorId: string,
  descriptorStatus: string
): ApiError {
  return {
    detail: `Descriptor ${descriptorId} has a not valid status for this operation ${descriptorStatus}`,
    code: "0004",
    httpStatus: 400,
    title: "Not valid descriptor",
  };
}

export function draftDescriptorAlreadyExists(eServiceId: string): ApiError {
  return {
    detail: `EService ${eServiceId} already contains a draft descriptor`,
    code: "0008",
    httpStatus: 400,
    title: "EService already contains a draft descriptor",
  };
}

export function invalidDescriptorVersion(details: string): ApiError {
  return {
    detail: details,
    code: "0004",
    httpStatus: 400,
    title: "Version is not a valid descriptor version",
  };
}
