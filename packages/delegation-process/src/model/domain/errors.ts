import {
  ApiError,
  EServiceId,
  makeApiProblemBuilder,
  TenantId,
  DelegationState,
} from "pagopa-interop-models";

export const errorCodes = {
  delegationNotFound: "0001",
  eserviceNotFound: "0002",
  delegationAlreadyExists: "0003",
  tenantNotFound: "0004",
  invalidDelegatorAndDelegateIds: "0005",
  invalidExternalOriginId: "0006",
  tenantNotAllowedToDelegation: "0007",
  operationRestrictedToDelegator: "0008",
  incorrectState: "0009",
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

export function operationRestrictedToDelegator(
  tenantId: string,
  delegationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not a delegator for delegation ${delegationId}`,
    code: "operationRestrictedToDelegator",
    title: "Operation restricted to delegator",
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
