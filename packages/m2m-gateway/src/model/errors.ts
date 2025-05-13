import {
  attributeRegistryApi,
  delegationApi,
  authorizationApi,
} from "pagopa-interop-api-clients";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  resourcePollingTimeout: "0001",
  missingMetadata: "0002",
  unexpectedDelegationKind: "0003",
  unexpectedAttributeKind: "0004",
  unexpectedUndefinedAttributeOriginOrCode: "0005",
  attributeNotFound: "0006",
  clientAdminIdNotFound: "0007",
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
    title: "Resource polling timeout",
  });
}

export function missingMetadata(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Resource metadata is missing",
    code: "missingMetadata",
    title: "Missing metadata",
  });
}

export function unexpectedDelegationKind(
  delegation: delegationApi.Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected delegation kind "${delegation.kind}" for delegation ${delegation.id}`,
    code: "unexpectedDelegationKind",
    title: "Unexpected delegation kind",
  });
}

export function unexpectedAttributeKind(
  attribute: attributeRegistryApi.Attribute
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected attribute kind "${attribute.kind}" for attribute ${attribute.id}`,
    code: "unexpectedAttributeKind",
    title: "Unexpected attribute kind",
  });
}

export function unexpectedUndefinedAttributeOriginOrCode(
  attribute: attributeRegistryApi.Attribute
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attribute.id} has undefined origin or code`,
    code: "unexpectedUndefinedAttributeOriginOrCode",
    title: "Unexpected undefined attribute origin or code",
  });
}

export function attributeNotFound(
  attribute: attributeRegistryApi.Attribute
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attribute.id} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
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
