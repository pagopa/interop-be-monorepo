import {
  ApiError,
  Delegation,
  EServiceId,
  makeApiProblemBuilder,
  TenantId,
  DelegationState,
  DelegationKind,
  Tenant,
} from "pagopa-interop-models";

export const errorCodes = {
  delegationNotFound: "0001",
  eserviceNotFound: "0002",
  delegationAlreadyExists: "0003",
  tenantNotFound: "0004",
  delegatorAndDelegateSameId: "0005",
  tenantIsNotIPAError: "0006",
  tenantNotAllowedToDelegation: "0007",
  delegationNotRevokable: "0008",
  operationNotAllowOnDelegation: "0009",
  operationRestrictedToDelegate: "0010",
  incorrectState: "0011",
  differentEserviceProducer: "0012",
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
  delegatorId: string,
  eserviceId: string,
  delegationKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation type ${delegationKind} already exists for EService ${eserviceId} by delegator ${delegatorId}`,
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
    code: "delegatorAndDelegateSameId",
    title: "Delegator and Delegate have the same Id",
  });
}

export function tenantIsNotIPAError(tenant: Tenant): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `${tenant.id} with external origin ${tenant.externalId.origin} is not an IPA`,
    code: "tenantIsNotIPAError",
    title: `Invalid external origin`,
  });
}

export function tenantNotAllowedToDelegation(
  tenantId: string,
  kind: DelegationKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not allowed to receive delegations of kind: ${kind}`,
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

export function operationRestrictedToDelegate(
  tenantId: string,
  delegationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not a delegate for delegation ${delegationId}`,
    code: "operationRestrictedToDelegate",
    title: "Operation restricted to delegate",
  });
}

export function incorrectState(
  delegationId: string,
  actualState: DelegationState,
  expectedState: DelegationState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} is in state ${actualState} but expected ${expectedState}`,
    code: "incorrectState",
    title: "Incorrect state",
  });
}

export function differentEServiceProducer(
  requesterId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Eservice producer if different from requester with id ${requesterId}`,
    code: "differentEserviceProducer",
    title: "Operation not allowed",
  });
}
