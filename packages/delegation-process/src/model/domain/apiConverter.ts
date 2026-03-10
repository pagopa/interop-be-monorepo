import { delegationApi } from "pagopa-interop-api-clients";
import {
  Delegation,
  DelegationContractDocument,
  DelegationKind,
  DelegationSignedContractDocument,
  DelegationStamp,
  DelegationStamps,
  DelegationState,
  delegationKind,
  delegationState,
  unsafeBrandId,
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
  updatedAt: delegation.updatedAt ? delegation.updatedAt.toJSON() : undefined,
  rejectionReason: delegation.rejectionReason || undefined,
  state: delegationStateToApiDelegationState(delegation.state),
  kind: delegationKindToApiDelegationKind(delegation.kind),
  activationContract: delegation.activationContract
    ? delegationContractToApiDelegationContract(delegation.activationContract)
    : undefined,
  revocationContract: delegation.revocationContract
    ? delegationContractToApiDelegationContract(delegation.revocationContract)
    : undefined,
  stamps: delegationStampsToApiDelegationStamps(delegation.stamps),
  activationSignedContract: delegation.activationSignedContract
    ? delegationSignedContractToApiDelegationSignedContract(
        delegation.activationSignedContract
      )
    : undefined,
  revocationSignedContract: delegation.revocationSignedContract
    ? delegationSignedContractToApiDelegationSignedContract(
        delegation.revocationSignedContract
      )
    : undefined,
});

const delegationStateToApiDelegationState = (
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

const delegationKindToApiDelegationKind = (
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

const delegationSignedContractToApiDelegationSignedContract = (
  contract: DelegationSignedContractDocument
): delegationApi.DelegationSignedContractDocument => ({
  id: contract.id,
  name: contract.name,
  prettyName: contract.prettyName,
  contentType: contract.contentType,
  path: contract.path,
  createdAt: contract.createdAt.toJSON(),
  signedAt: contract.signedAt?.toJSON(),
});

const delegationStampsToApiDelegationStamps = (
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

const delegationStampToApiDelegationStamp = (
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

export const apiDelegationSignedContractToDelegationSignedContract = (
  input: delegationApi.DelegationSignedContractDocument
): DelegationSignedContractDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(input.createdAt),
  signedAt: input.signedAt ? new Date(input.signedAt) : undefined,
});
