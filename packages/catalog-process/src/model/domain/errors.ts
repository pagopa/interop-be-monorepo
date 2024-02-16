import {
  ApiError,
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
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
  interfaceAlreadyExists: "0011",
  attributeNotFound: "0012",
  inconsistentDailyCalls: "0013",
  dailyCallsCannotBeDecreased: "0014",
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

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
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
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} contains valid descriptors and cannot be updated`,
    ...eserviceCannotBeUpdatedOrDeleted,
  });
}

export function eServiceCannotBeDeleted(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} contains descriptors and cannot be deleted`,
    ...eserviceCannotBeUpdatedOrDeleted,
  });
}

export function eServiceDescriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} for EService ${eserviceId} not found`,
    code: "eServiceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}

export function eServiceDocumentNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  documentId: EServiceDocumentId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document with id ${documentId} not found in EService ${eserviceId} / Descriptor ${descriptorId}`,
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
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} already contains a draft descriptor`,
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

export function interfaceAlreadyExists(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} already contains an interface`,
    code: "interfaceAlreadyExists",
    title: "Descriptor already contains an interface",
  });
}

export function attributeNotFound(attributeId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function inconsistentDailyCalls(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `dailyCallsPerConsumer can't be greater than dailyCallsTotal`,
    code: "inconsistentDailyCalls",
    title: "Inconsistent daily calls",
  });
}

export function dailyCallsCannotBeDecreased(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `dailyCallsPerConsumer and dailyCallsTotal can't be decreased`,
    code: "dailyCallsCannotBeDecreased",
    title: "Daily Calls limits Can't be decreased",
  });
}
