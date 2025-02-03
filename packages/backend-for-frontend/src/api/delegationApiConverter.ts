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
import { toCompactDescriptor } from "./catalogApiConverter.js";
import { toCompactEserviceLight } from "./agreementApiConverter.js";

export type DelegationsQueryParams = {
  delegatorIds?: string[];
  delegateIds?: string[];
  delegationStates?: delegationApi.DelegationState[];
  kind?: delegationApi.DelegationKind;
  eserviceIds?: string[];
};

export function toDelegationState(
  state: DelegationState
): bffApi.DelegationState {
  return match(state)
    .with(delegationState.active, () => bffApi.DelegationState.Values.ACTIVE)
    .with(
      delegationState.rejected,
      () => bffApi.DelegationState.Values.REJECTED
    )
    .with(delegationState.revoked, () => bffApi.DelegationState.Values.REVOKED)
    .with(
      delegationState.waitingForApproval,
      () => bffApi.DelegationState.Values.WAITING_FOR_APPROVAL
    )
    .exhaustive();
}

export function toDelegationKind(
  kind: DelegationKind
): delegationApi.DelegationKind {
  return match(kind)
    .with(
      delegationKind.delegatedConsumer,
      () => bffApi.DelegationKind.Values.DELEGATED_CONSUMER
    )
    .with(
      delegationKind.delegatedProducer,
      () => bffApi.DelegationKind.Values.DELEGATED_PRODUCER
    )
    .exhaustive();
}

export function toBffDelegationApiDelegationDoc(
  document: delegationApi.DelegationContractDocument
): bffApi.Document {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
    createdAt: document.createdAt,
  };
}

export function toBffDelegationApiDelegation(
  delegation: delegationApi.Delegation,
  delegator: tenantApi.Tenant,
  delegate: tenantApi.Tenant,
  eservice: catalogApi.EService | undefined,
  producer: tenantApi.Tenant
): bffApi.Delegation {
  return {
    id: delegation.id,
    eservice: eservice && {
      id: eservice.id,
      name: eservice.name,
      description: eservice.description,
      producerId: eservice.producerId,
      producerName: producer.name,
      descriptors: eservice.descriptors.map(toCompactDescriptor),
    },
    delegate: {
      id: delegate.id,
      name: delegate.name,
    },
    delegator: {
      id: delegator.id,
      name: delegator.name,
    },
    activationContract: delegation.activationContract
      ? toBffDelegationApiDelegationDoc(delegation.activationContract)
      : undefined,
    revocationContract: delegation.revocationContract
      ? toBffDelegationApiDelegationDoc(delegation.revocationContract)
      : undefined,
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
  eservice: catalogApi.EService | undefined
): bffApi.CompactDelegation {
  return {
    id: delegation.id,
    eservice: eservice && toCompactEserviceLight(eservice),
    delegate: {
      name: delegate.name,
      id: delegate.id,
    },
    delegator: {
      name: delegator.name,
      id: delegator.id,
    },
    state: delegation.state,
    kind: delegation.kind,
  };
}
