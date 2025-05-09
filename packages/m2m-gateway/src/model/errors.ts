import { authorizationApi, delegationApi } from "pagopa-interop-api-clients";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  resourcePollingTimeout: "0001",
  missingMetadata: "0002",
  unexpectedDelegationKind: "0003",
  clientAdminIdNotFound: "0004",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, {
  problemErrorsPassthrough: true,
  forceGenericProblemOn500: true,
});

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

export function clientAdminIdNotFound(
  client: authorizationApi.Client
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Admin id not found for client with id ${client.id}`,
    code: "clientAdminIdNotFound",
    title: "Client admin id not found",
  });
}
