import {
  ApiError,
  Delegation,
  EServiceId,
  makeApiProblemBuilder,
  TenantId,
  DelegationState,
  DelegationId,
  DelegationContractId,
  DelegationKind,
  Tenant,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const errorCodes = {
  delegationNotFound: "0001",
  eserviceNotFound: "0002",
  delegationAlreadyExists: "0003",
  tenantNotFound: "0004",
  invalidDelegatorAndDelegateIds: "0005",
  originNotCompliant: "0006",
  tenantNotAllowedToDelegation: "0007",
  stampNotFound: "0008",
  operationRestrictedToDelegator: "0009",
  operationRestrictedToDelegate: "0010",
  incorrectState: "0011",
  differentEserviceProducer: "0012",
  delegationContractNotFound: "0013",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function delegationNotFound(
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function delegationAlreadyExists(
  delegatorId: TenantId,
  eserviceId: EServiceId,
  delegationKind: DelegationKind
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
    code: "invalidDelegatorAndDelegateIds",
    title: "Invalid Delegator and Delegate",
  });
}

export function originNotCompliant(
  tenant: Tenant,
  delegatorOrDelegate: "Delegator" | "Delegate"
): ApiError<ErrorCodes> {
  const delegatorOrDelegateString = match(delegatorOrDelegate)
    .with("Delegator", () => "Delegator")
    .with("Delegate", () => "Delegate")
    .exhaustive();
  return new ApiError({
    detail: `${delegatorOrDelegateString} ${tenant.id} with external origin ${tenant.externalId?.origin} is not allowed`,
    code: "originNotCompliant",
    title: "Origin is not compliant",
  });
}

export function tenantNotAllowedToDelegation(
  tenantId: TenantId,
  kind: DelegationKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not allowed to receive delegations of kind: ${kind}`,
    code: "tenantNotAllowedToDelegation",
    title: "Tenant not allowed to delegation",
  });
}

export function operationRestrictedToDelegate(
  tenantId: TenantId,
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not a delegate for delegation ${delegationId}`,
    code: "operationRestrictedToDelegate",
    title: "Operation restricted to delegate",
  });
}

export function operationRestrictedToDelegator(
  tenantId: TenantId,
  delegationId: DelegationId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not a delegator for delegation ${delegationId}`,
    code: "operationRestrictedToDelegator",
    title: "Operation restricted to delegator",
  });
}

export function incorrectState(
  delegationId: DelegationId,
  actualState: DelegationState,
  expected: DelegationState | DelegationState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} is in state ${actualState} but expected ${
      Array.isArray(expected) ? expected.join(",") : expected
    }`,
    code: "incorrectState",
    title: "Incorrect state",
  });
}

export function differentEServiceProducer(
  requesterId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Eservice producer if different from requester with id ${requesterId}`,
    code: "differentEserviceProducer",
    title: "Operation not allowed",
  });
}

export function delegationContractNotFound(
  delegationId: DelegationId,
  contractId: DelegationContractId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Contract ${contractId} of delegation ${delegationId} not found`,
    code: "delegationContractNotFound",
    title: "Delegation contract not found",
  });
}

export function delegationStampNotFound(
  stamp: keyof Delegation["stamps"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${stamp} stamp not found`,
    code: "stampNotFound",
    title: "Stamp not found",
  });
}
