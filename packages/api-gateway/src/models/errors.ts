import { agreementApi, purposeApi } from "pagopa-interop-api-clients";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  invalidAgreementState: "0001",
  producerAndConsumerParamMissing: "0002",
  missingActivePurposeVersion: "0003",
  activeAgreementByEserviceAndConsumerNotFound: "0004",
  multipleAgreementForEserviceAndConsumer: "0005",
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
