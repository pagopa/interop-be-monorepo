import { delegationApi } from "pagopa-interop-api-clients";
import {
  Delegation,
  DelegationContractDocument,
  DelegationKind,
  DelegationStamp,
  DelegationStamps,
  DelegationState,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const delegationToApiDelegation = (
  delegation: Delegation
): delegationApi.Delegation => ({
  id: delegation.id,
  delegatorId: delegation.delegatorId,
  delegateId: delegation.delegateId,
  eserviceId: delegation.eserviceId,
  createdAt: delegation.createdAt.toJSON(),
  submittedAt: delegation.submittedAt.toJSON(),
  approvedAt: delegation.approvedAt
    ? delegation.approvedAt.toJSON()
    : undefined,
  rejectedAt: delegation.rejectedAt
    ? delegation.rejectedAt.toJSON()
    : undefined,
  rejectionReason: delegation.rejectionReason || undefined,
  revokedAt: delegation.revokedAt ? delegation.revokedAt.toJSON() : undefined,
  state: delegationStateToApiDelegationState(delegation.state),
  kind: delegationKindToApiDelegationKind(delegation.kind),
  activationContract: delegation.activationContract
    ? delegationContractToApiDelegationContract(delegation.activationContract)
    : undefined,
  revocationContract: delegation.revocationContract
    ? delegationContractToApiDelegationContract(delegation.revocationContract)
    : undefined,
  stamps: delegationStampsToApiDelegationStamps(delegation.stamps),
});

export const delegationStateToApiDelegationState = (
  state: DelegationState
): delegationApi.DelegationState =>
  match<DelegationState, delegationApi.DelegationState>(state)
    .with(
      delegationState.active,
      () => delegationApi.DelegationState.Values.ACTIVE
    )
    .with(
      delegationState.rejected,
      () => delegationApi.DelegationState.Values.REJECTED
    )
    .with(
      delegationState.revoked,
      () => delegationApi.DelegationState.Values.REVOKED
    )
    .with(
      delegationState.waitingForApproval,
      () => delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL
    )
    .exhaustive();

export const delegationKindToApiDelegationKind = (
  kind: DelegationKind
): delegationApi.DelegationKind =>
  match<DelegationKind, delegationApi.DelegationKind>(kind)
    .with(
      delegationKind.delegatedConsumer,
      () => delegationApi.DelegationKind.Values.DELEGATED_CONSUMER
    )
    .with(
      delegationKind.delegatedProducer,
      () => delegationApi.DelegationKind.Values.DELEGATED_PRODUCER
    )
    .exhaustive();

export const apiDelegationKindToDelegationKind = (
  kind: delegationApi.DelegationKind
): DelegationKind =>
  match<delegationApi.DelegationKind, DelegationKind>(kind)
    .with(
      delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      () => delegationKind.delegatedConsumer
    )
    .with(
      delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
      () => delegationKind.delegatedProducer
    )
    .exhaustive();

export const delegationContractToApiDelegationContract = (
  contract: DelegationContractDocument
): delegationApi.DelegationContractDocument => ({
  id: contract.id,
  name: contract.name,
  prettyName: contract.prettyName,
  contentType: contract.contentType,
  path: contract.path,
  createdAt: contract.createdAt.toJSON(),
});

export const delegationStampsToApiDelegationStamps = (
  stamps: DelegationStamps
): delegationApi.DelegationStamps => ({
  submission: delegationStampToApiDelegationStamp(stamps.submission),
  activation: stamps.activation
    ? delegationStampToApiDelegationStamp(stamps.activation)
    : undefined,
  rejection: stamps.rejection
    ? delegationStampToApiDelegationStamp(stamps.rejection)
    : undefined,
  revocation: stamps.revocation
    ? delegationStampToApiDelegationStamp(stamps.revocation)
    : undefined,
});

export const delegationStampToApiDelegationStamp = (
  stamp: DelegationStamp
): delegationApi.DelegationStamp => ({
  who: stamp.who,
  when: stamp.when.toJSON(),
});

export const apiDelegationStateToDelegationState = (
  state: delegationApi.DelegationState
): DelegationState =>
  match<delegationApi.DelegationState, DelegationState>(state)
    .with(
      delegationApi.DelegationState.Values.ACTIVE,
      () => delegationState.active
    )
    .with(
      delegationApi.DelegationState.Values.REJECTED,
      () => delegationState.rejected
    )
    .with(
      delegationApi.DelegationState.Values.REVOKED,
      () => delegationState.revoked
    )
    .with(
      delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
      () => delegationState.waitingForApproval
    )
    .exhaustive();
