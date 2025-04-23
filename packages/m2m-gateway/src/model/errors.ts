import { delegationApi } from "pagopa-interop-api-clients";
import {
  ApiError,
  makeApiProblemBuilder,
  PurposeId,
  PurposeVersionId,
} from "pagopa-interop-models";

export const errorCodes = {
  resourcePollingTimeout: "0001",
  missingMetadata: "0002",
  unexpectedDelegationKind: "0003",
  purposeVersionNotFound: "0004",
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

export function purposeVersionNotFound(
  purposeId: PurposeId,
  versionId: PurposeVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} not found in purpose ${purposeId}`,
    code: "purposeVersionNotFound",
    title: "Purpose version not found",
  });
}
