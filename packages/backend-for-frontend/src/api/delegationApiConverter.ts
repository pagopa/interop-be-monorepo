import {
  bffApi,
  catalogApi,
  delegationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  DelegationKind,
  delegationKind,
  delegationState,
  DelegationState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export type DelegationsQueryParams = {
  delegatorIds?: string[];
  delegateIds?: string[];
  delegationStates?: delegationApi.DelegationState[];
  kind?: delegationApi.DelegationKind;
};

export function toDelegationState(
  state: DelegationState
): bffApi.DelegationState {
  return match(state)
    .with(delegationState.active, () => "ACTIVE" as const)
    .with(delegationState.rejected, () => "REJECTED" as const)
    .with(delegationState.revoked, () => "REVOKED" as const)
    .with(
      delegationState.waitingForApproval,
      () => "WAITING_FOR_APPROVAL" as const
    )
    .exhaustive();
}

export function toDelegationKind(
  kind: DelegationKind
): delegationApi.DelegationKind {
  return match(kind)
    .with(delegationKind.delegatedConsumer, () => "DELEGATED_CONSUMER" as const)
    .with(delegationKind.delegatedProducer, () => "DELEGATED_PRODUCER" as const)
    .exhaustive();
}

export function toBffDelegationApiDelegation(
  delegation: delegationApi.Delegation,
  delegator: tenantApi.Tenant,
  delegate: tenantApi.Tenant,
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.Delegation {
  return {
    id: delegation.id,
    eservice: {
      id: eservice.id,
      name: eservice.name,
      description: eservice.description,
      producerId: eservice.producerId,
      producerName: producer.name,
    },
    delegate: {
      id: delegate.id,
      name: delegate.name,
    },
    delegator: {
      id: delegator.id,
      name: delegator.name,
    },
    contract: delegation.contract,
    submittedAt: delegation.submittedAt,
    rejectionReason: delegation.rejectionReason,
    state: delegation.state,
    kind: delegation.kind,
  };
}

export function toBffDelegationApiCompactDelegation(
  delegation: delegationApi.Delegation,
  delegator: tenantApi.Tenant,
  delegate: tenantApi.Tenant,
  eservice: catalogApi.EService
): bffApi.CompactDelegation {
  return {
    id: delegation.id,
    eserviceName: eservice.name,
    delegatedName: delegate.name,
    delegatorName: delegator.name,
    state: delegation.state,
    kind: delegation.kind,
  };
}
