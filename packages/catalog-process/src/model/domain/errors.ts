import { ApiError } from "pagopa-interop-models";

export const errorCodes = {
  eServiceDescriptorNotFound: "0002",
  eServiceDescriptorWithoutInterface: "0003",
  notValidDescriptor: "0004",
  eServiceDocumentNotFound: "0006",
  eServiceNotFound: "0007",
  draftDescriptorAlreadyExists: "0008",
  eserviceCannotBeUpdatedOrDeleted: "0009",
  eServiceDuplicate: "0010",
};

const eserviceCannotBeUpdatedOrDeleted = {
  code: errorCodes.eserviceCannotBeUpdatedOrDeleted,
  title: "EService cannot be updated or deleted",
};

export function eServiceNotFound(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: errorCodes.eServiceNotFound,
    title: "EService not found",
  });
}

export function eServiceDuplicate(eServiceNameSeed: string): ApiError {
  return new ApiError({
    detail: `ApiError during EService creation with name ${eServiceNameSeed}`,
    code: errorCodes.eServiceDuplicate,
    title: "Duplicated service name",
  });
}

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
    title: "Not valid descriptor",
  });
}

export function eServiceDescriptorWithoutInterface(
  descriptorId: string
): ApiError {
  return new ApiError({
    detail: `Descriptor ${descriptorId} does not have an interface`,
    code: errorCodes.eServiceDescriptorWithoutInterface,
    title: "Not valid descriptor",
  });
}

export function draftDescriptorAlreadyExists(eServiceId: string): ApiError {
  return new ApiError({
    detail: `EService ${eServiceId} already contains a draft descriptor`,
    code: errorCodes.draftDescriptorAlreadyExists,
    title: "EService already contains a draft descriptor",
  });
}

export function invalidDescriptorVersion(details: string): ApiError {
  return new ApiError({
    detail: details,
    code: errorCodes.notValidDescriptor,
    title: "Version is not a valid descriptor version",
  });
}
