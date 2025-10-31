import { match } from "ts-pattern";
import {
  DelegationV2,
  DelegationStampV2,
  DelegationStampsV2,
  DelegationStateV2,
  DelegationKindV2,
  DelegationContractDocumentV2,
} from "../gen/v2/delegation/delegation.js";
import { dateToBigInt } from "../utils.js";
import {
  Delegation,
  DelegationKind,
  delegationKind,
  DelegationContractDocument,
  DelegationStamp,
  DelegationStamps,
  DelegationState,
  delegationState,
} from "./delegation.js";

export const toDelegationStateV2 = (
  state: DelegationState
): DelegationStateV2 =>
  match(state)
    .with(delegationState.active, () => DelegationStateV2.ACTIVE)
    .with(delegationState.rejected, () => DelegationStateV2.REJECTED)
    .with(delegationState.revoked, () => DelegationStateV2.REVOKED)
    .with(
      delegationState.waitingForApproval,
      () => DelegationStateV2.WAITING_FOR_APPROVAL
    )
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

export const toDelegationContractDocumentV2 = (
  contract: DelegationContractDocument
): DelegationContractDocumentV2 => ({
  ...contract,
  createdAt: dateToBigInt(contract.createdAt),
  signedAt: dateToBigInt(contract.signedAt),
});

export const toDelegationStampV2 = (
  stamp: DelegationStamp
): DelegationStampV2 => ({
  when: dateToBigInt(stamp.when),
  who: stamp.who,
});

export const toDelegationStampsV2 = (
  input: DelegationStamps
): DelegationStampsV2 => ({
  submission: toDelegationStampV2(input.submission),
  activation: input.activation && toDelegationStampV2(input.activation),
  rejection: input.rejection && toDelegationStampV2(input.rejection),
  revocation: input.revocation && toDelegationStampV2(input.revocation),
});

export const toDelegationV2 = (delegation: Delegation): DelegationV2 => ({
  ...delegation,
  state: toDelegationStateV2(delegation.state),
  kind: toDelegationKindV2(delegation.kind),
  createdAt: dateToBigInt(delegation.createdAt),
  updatedAt: dateToBigInt(delegation.updatedAt),
  stamps: toDelegationStampsV2(delegation.stamps),
  rejectionReason: delegation.rejectionReason,
  activationContract:
    delegation.activationContract &&
    toDelegationContractDocumentV2(delegation.activationContract),
  revocationContract:
    delegation.revocationContract &&
    toDelegationContractDocumentV2(delegation.revocationContract),
});
