import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  invalidAgreementState: "0001",
  producerAndConsumerParamMissing: "0002",
  missingActivePurposeVersion: "0003",
  activeAgreementByEserviceAndConsumerNotFound: "0004",
  multipleAgreementForEserviceAndConsumer: "0005",
  missingAvailableDescriptor: "0006",
  unexpectedDescriptorState: "0007",
  attributeNotFoundInRegistry: "0008",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function invalidAgreementState(
  state: agreementApi.AgreementState,
  agreementId: agreementApi.Agreement["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot retrieve agreement in ${state} state - id: ${agreementId}`,
    code: "invalidAgreementState",
    title: "Invalid agreement state",
  });
}

export function producerAndConsumerParamMissing(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Either producerId or consumerId required",
    code: "producerAndConsumerParamMissing",
    title: "Producer and Consumer param missing",
  });
}

export function missingActivePurposeVersion(
  purposeId: purposeApi.Purpose["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no active version for purpose ${purposeId}`,
    code: "missingActivePurposeVersion",
    title: "Missing active purpose version",
  });
}

export function activeAgreementByEserviceAndConsumerNotFound(
  eserviceId: agreementApi.Agreement["eserviceId"],
  consumerId: agreementApi.Agreement["consumerId"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Active Agreement not found for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "activeAgreementByEserviceAndConsumerNotFound",
    title: "Active Agreement not found",
  });
}

export function multipleAgreementForEserviceAndConsumer(
  eserviceId: agreementApi.Agreement["eserviceId"],
  consumerId: agreementApi.Agreement["consumerId"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected multiple Active Agreements for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "multipleAgreementForEserviceAndConsumer",
    title: "Multiple active Agreements found",
  });
}

export function missingAvailableDescriptor(
  eserviceId: catalogApi.EService["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No available descriptors for EService ${eserviceId}`,
    code: "missingAvailableDescriptor",
    title: "Missing available descriptor",
  });
}

export function unexpectedDescriptorState(
  state: catalogApi.EServiceDescriptorState,
  descriptorId: catalogApi.EServiceDescriptor["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected Descriptor state: ${state} - id: ${descriptorId}`,
    code: "unexpectedDescriptorState",
    title: "Unexpected descriptor state",
  });
}

export function attributeNotFoundInRegistry(
  attributeId: attributeRegistryApi.Attribute["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found in Attribute Registry`,
    code: "attributeNotFoundInRegistry",
    title: "Attribute not found in Attribute Registry",
  });
}
