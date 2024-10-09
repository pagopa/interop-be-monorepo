import { delegationApi } from "pagopa-interop-api-clients";
import {
  Delegation,
  DelegationContractDocument,
  DelegationKind,
  DelegationStamp,
  DelegationStamps,
  DelegationState,
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
  contract: delegation.contract
    ? delegationContractToApiDelegationContract(delegation.contract)
    : undefined,
  stamps: delegationStampsToApiDelegationStamps(delegation.stamps),
});

export const delegationStateToApiDelegationState = (
  state: DelegationState
): delegationApi.DelegationState =>
  match<DelegationState, delegationApi.DelegationState>(state)
    .with("Active", () => "ACTIVE")
    .with("Rejected", () => "REJECTED")
    .with("Revoked", () => "REVOKED")
    .with("WaitingForApproval", () => "WAITING_FOR_APPROVAL")
    .exhaustive();

export const delegationKindToApiDelegationKind = (
  kind: DelegationKind
): delegationApi.DelegationKind =>
  match<DelegationKind, delegationApi.DelegationKind>(kind)
    .with("DelegatedConsumer", () => "DELEGATED_CONSUMER")
    .with("DelegatedProducer", () => "DELEGATED_PRODUCER")
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
  delegationState: delegationApi.DelegationState
): DelegationState =>
  match<delegationApi.DelegationState, DelegationState>(delegationState)
    .with("ACTIVE", () => "Active")
    .with("REJECTED", () => "Rejected")
    .with("REVOKED", () => "Revoked")
    .with("WAITING_FOR_APPROVAL", () => "WaitingForApproval")
    .exhaustive();
