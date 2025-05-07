import { delegationApi, purposeApi } from "pagopa-interop-api-clients";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  resourcePollingTimeout: "0001",
  missingMetadata: "0002",
  unexpectedDelegationKind: "0003",
  purposeNotFound: "0004",
  missingActivePurposeVersion: "0005",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, true);

export function resourcePollingTimeout(
  maxAttempts: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Resource polling timed out after ${maxAttempts} attempts`,
    code: "resourcePollingTimeout",
    title: "Resource Polling Timeout",
  });
}

export function missingMetadata(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Resource metadata is missing",
    code: "missingMetadata",
    title: "Missing Metadata",
  });
}

export function unexpectedDelegationKind(
  delegation: delegationApi.Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected delegation kind "${delegation.kind}" for delegation ${delegation.id}`,
    code: "unexpectedDelegationKind",
    title: "Unexpected Delegation Kind",
  });
}

export function purposeNotFound(
  purposeId: purposeApi.Purpose["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
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
