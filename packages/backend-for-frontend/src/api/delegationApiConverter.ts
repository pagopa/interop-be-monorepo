/* eslint-disable max-params */
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
export function toBffDelegationApiDelegationSignedDoc(
  document: delegationApi.DelegationSignedContractDocument
): bffApi.SignedDocument {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
    createdAt: document.createdAt,
    signedAt: document.signedAt,
  };
}

export function toBffDelegationApiDelegation(
  delegation: delegationApi.Delegation,
  delegator: tenantApi.Tenant,
  delegate: tenantApi.Tenant,
  eservice: catalogApi.EService | undefined,
  _: boolean | undefined,
  producer: tenantApi.Tenant
): bffApi.Delegation {
  // The document is considered "ready" if the contract required for its current state is signed.
  // When in the 'revoked' state, only the 'signedRevocationContract' is checked, as the 'signedActivationContract'
  // is guaranteed to exist as a prerequisite for revocation.
  const isDocumentReady =
    delegation.state === toDelegationState(delegationState.revoked)
      ? delegation.signedRevocationContract !== undefined
      : delegation.signedActivationContract !== undefined;
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
    createdAt: delegation.createdAt,
    updatedAt: delegation.updatedAt,
    rejectionReason: delegation.rejectionReason,
    state: delegation.state,
    kind: delegation.kind,
    activationSignedContract: delegation.activationSignedContract
      ? toBffDelegationApiDelegationSignedDoc(
          delegation.activationSignedContract
        )
      : undefined,
    revocationSignedContract: delegation.revocationSignedContract
      ? toBffDelegationApiDelegationSignedDoc(
          delegation.revocationSignedContract
        )
      : undefined,
    isDocumentReady,
  };
}

export function toBffDelegationApiCompactDelegation(
  delegation: delegationApi.Delegation,
  delegator: tenantApi.Tenant,
  delegate: tenantApi.Tenant,
  eservice: catalogApi.EService | undefined,
  hasNotifications: boolean | undefined
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
    hasUnreadNotifications: hasNotifications || false,
  };
}
