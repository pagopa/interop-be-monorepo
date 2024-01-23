import {
  ApiError,
  DescriptorId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

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

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

const eserviceCannotBeUpdatedOrDeleted: {
  code: ErrorCodes;
  title: string;
} = {
  code: "eserviceCannotBeUpdatedOrDeleted",
  title: "EService cannot be updated or deleted",
};

export function eServiceNotFound(eServiceId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function eServiceDuplicate(
  eServiceNameSeed: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `ApiError during EService creation with name ${eServiceNameSeed}`,
    code: "eServiceDuplicate",
    title: "Duplicated service name",
  });
}

export function eServiceCannotBeUpdated(
  eServiceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} contains valid descriptors and cannot be updated`,
    ...eserviceCannotBeUpdatedOrDeleted,
  });
}

export function eServiceCannotBeDeleted(
  eServiceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} contains descriptors and cannot be deleted`,
    ...eserviceCannotBeUpdatedOrDeleted,
  });
}

export function eServiceDescriptorNotFound(
  eServiceId: string,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
    code: "eServiceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}

export function eServiceDocumentNotFound(
  eServiceId: string,
  descriptorId: DescriptorId,
  documentId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
    code: "eServiceDocumentNotFound",
    title: "EService document not found",
  });
}

export function notValidDescriptor(
  descriptorId: DescriptorId,
  descriptorStatus: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} has a not valid status for this operation ${descriptorStatus}`,
    code: "notValidDescriptor",
    title: "Not valid descriptor",
  });
}

export function eServiceDescriptorWithoutInterface(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} does not have an interface`,
    code: "eServiceDescriptorWithoutInterface",
    title: "Not valid descriptor",
  });
}

export function draftDescriptorAlreadyExists(
  eServiceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} already contains a draft descriptor`,
    code: "draftDescriptorAlreadyExists",
    title: "EService already contains a draft descriptor",
  });
}

export function invalidDescriptorVersion(
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: details,
    code: "notValidDescriptor",
    title: "Version is not a valid descriptor version",
  });
}
