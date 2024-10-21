import {
  ApiError,
  Delegation,
  EServiceId,
  makeApiProblemBuilder,
  TenantId,
} from "pagopa-interop-models";

export const errorCodes = {
  delegationNotFound: "0001",
  eserviceNotFound: "0002",
  delegationAlreadyExists: "0003",
  tenantNotFound: "0004",
  invalidDelegatorAndDelegateIds: "0005",
  invalidExternalOriginId: "0006",
  tenantNotAllowedToDelegation: "0007",
  delegationNotRevokable: "0008",
  operationNotAllowOnDelegation: "0009",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function delegationNotFound(delegationId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function delegationAlreadyExists(
  delgatorId: string,
  delegeteId: string,
  eserviceId: string,
  delegationKind: string,
  delegationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation type ${delegationKind} already exists with id ${delegationId} for delegator ${delgatorId} and delegate ${delegeteId} for EService ${eserviceId}`,
    code: "delegationAlreadyExists",
    title: "Delegation already exists",
  });
}

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function delegatorAndDelegateSameIdError(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error occurs because Delegator and Delegate have the same Id`,
    code: "invalidDelegatorAndDelegateIds",
    title: "Invalid Delegator and Delegate",
  });
}

export function invalidExternalOriginError(
  externalOrigin?: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegator is not an IPA`,
    code: "invalidExternalOriginId",
    title: `Invalid External origin ${externalOrigin}`,
  });
}

export function tenantNotAllowedToDelegation(
  tenantId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not allowed to delegation`,
    code: "tenantNotAllowedToDelegation",
    title: "Tenant not allowed to delegation",
  });
}

export function delegationNotRevokable(
  delegation: Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegation.id} is not revokable. State: ${delegation.state}`,
    code: "delegationNotRevokable",
    title: "Delegation not revokable",
  });
}

export function delegatorNotAllowToRevoke(
  delegation: Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester ${delegation.id} is not delegator for the current delegation with id ${delegation.id}`,
    code: "operationNotAllowOnDelegation",
    title: "Requester and delegator are differents",
  });
}