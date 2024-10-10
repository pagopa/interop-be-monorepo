import { match } from "ts-pattern";
import {
  DelegationV2,
  DelegationStampV2,
  DelegationStampsV2,
  DelegationStateV2,
  DelegationKindV2,
} from "../gen/v2/delegation/delegation.js";
import { dateToBigInt } from "../utils.js";
import {
  Delegation,
  DelegationKind,
  delegationKind,
  DelegationStamp,
  DelegationStamps,
  DelegationState,
  delegationState,
} from "./delegation.js";

export const toDelegationStampV2 = (
  input: DelegationStamp
): DelegationStampV2 => ({
  ...input,
  when: dateToBigInt(input.when),
});

export const toDelegationStampsV2 = (
  input: DelegationStamps
): DelegationStampsV2 => ({
  submission: toDelegationStampV2(input.submission),
  activation: input.activation
    ? toDelegationStampV2(input.activation)
    : undefined,
  rejection: input.rejection ? toDelegationStampV2(input.rejection) : undefined,
  revocation: input.revocation
    ? toDelegationStampV2(input.revocation)
    : undefined,
});

export const toDelegationStateV2 = (
  state: DelegationState
): DelegationStateV2 =>
  match(state)
    .with(
      delegationState.waitingForApproval,
      () => DelegationStateV2.WAITING_FOR_APPROVAL
    )
    .with(delegationState.active, () => DelegationStateV2.ACTIVE)
    .with(delegationState.rejected, () => DelegationStateV2.REJECTED)
    .with(delegationState.revoked, () => DelegationStateV2.REVOKED)
    .exhaustive();

export const toDelegationKindV2 = (kind: DelegationKind): DelegationKindV2 =>
  match(kind)
    .with(
      delegationKind.delegatedConsumer,
      () => DelegationKindV2.DELEGATED_CONSUMER
    )
    .with(
      delegationKind.delegatedProducer,
      () => DelegationKindV2.DELEGATED_PRODUCER
    )
    .exhaustive();

export const toDelegationV2 = (delegation: Delegation): DelegationV2 => ({
  ...delegation,
  state: toDelegationStateV2(delegation.state),
  kind: toDelegationKindV2(delegation.kind),
  createdAt: dateToBigInt(delegation.createdAt),
  submittedAt: dateToBigInt(delegation.submittedAt),
  approvedAt: dateToBigInt(delegation.approvedAt),
  rejectedAt: dateToBigInt(delegation.rejectedAt),
  revokedAt: dateToBigInt(delegation.revokedAt),
  stamps: toDelegationStampsV2(delegation.stamps),
  contract: delegation.contract
    ? {
        ...delegation.contract,
        createdAt: dateToBigInt(delegation.contract.createdAt),
      }
    : undefined,
});
