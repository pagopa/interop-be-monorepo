import { unsafeBrandId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import {
  DelegationContractDocumentV2,
  DelegationKindV2,
  DelegationSignedContractDocumentV2,
  DelegationStampsV2,
  DelegationStampV2,
  DelegationStateV2,
  DelegationV2,
} from "../gen/v2/delegation/delegation.js";
import { bigIntToDate } from "../utils.js";
import {
  Delegation,
  DelegationContractDocument,
  delegationKind,
  DelegationKind,
  DelegationSignedContractDocument,
  DelegationStamp,
  DelegationStamps,
  DelegationState,
  delegationState,
} from "./delegation.js";

export const fromDelegationStateV2 = (
  input: DelegationStateV2
): DelegationState => {
  switch (input) {
    case DelegationStateV2.ACTIVE:
      return delegationState.active;
    case DelegationStateV2.REJECTED:
      return delegationState.rejected;
    case DelegationStateV2.REVOKED:
      return delegationState.revoked;
    case DelegationStateV2.WAITING_FOR_APPROVAL:
      return delegationState.waitingForApproval;
  }
};

export const fromDelegationKindV2 = (
  input: DelegationKindV2
): DelegationKind => {
  switch (input) {
    case DelegationKindV2.DELEGATED_CONSUMER:
      return delegationKind.delegatedConsumer;
    case DelegationKindV2.DELEGATED_PRODUCER:
      return delegationKind.delegatedProducer;
  }
};

export const fromDelegationContractDocumentV2 = (
  input: DelegationContractDocumentV2
): DelegationContractDocument => ({
  id: unsafeBrandId(input.id),
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: bigIntToDate(input.createdAt),
});

export const fromDelegationSignedContractDocumentV2 = (
  input: DelegationSignedContractDocumentV2
): DelegationSignedContractDocument => ({
  id: unsafeBrandId(input.id),
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: bigIntToDate(input.createdAt),
  signedAt: bigIntToDate(input.signedAt),
});

export function fromDelegationStampV2(
  input: DelegationStampV2
): DelegationStamp;
export function fromDelegationStampV2(
  input: DelegationStampV2 | undefined
): DelegationStamp | undefined {
  return input
    ? {
        when: bigIntToDate(input.when),
        who: unsafeBrandId(input.who),
      }
    : undefined;
}

export const fromDelegationStampsV2 = (
  input: DelegationStampsV2
): DelegationStamps => {
  if (!input.submission) {
    throw genericError(
      `Error while deserializing DelegationStampsV2: missing submission stamp `
    );
  }

  return {
    submission: fromDelegationStampV2(input.submission),
    activation: input.activation
      ? fromDelegationStampV2(input.activation)
      : undefined,
    rejection: input.rejection
      ? fromDelegationStampV2(input.rejection)
      : undefined,
    revocation: input.revocation
      ? fromDelegationStampV2(input.revocation)
      : undefined,
  };
};

export const fromDelegationV2 = (input: DelegationV2): Delegation => {
  if (!input.stamps) {
    throw genericError(
      `Error while deserializing DelegationV2 (${input.id}): missing stamps `
    );
  }

  return {
    id: unsafeBrandId(input.id),
    delegatorId: unsafeBrandId(input.delegatorId),
    delegateId: unsafeBrandId(input.delegateId),
    eserviceId: unsafeBrandId(input.eserviceId),
    createdAt: bigIntToDate(input.createdAt),
    updatedAt: bigIntToDate(input.updatedAt),
    rejectionReason: input.rejectionReason,
    state: fromDelegationStateV2(input.state),
    kind: fromDelegationKindV2(input.kind),
    activationContract:
      input.activationContract &&
      fromDelegationContractDocumentV2(input.activationContract),
    revocationContract:
      input.revocationContract &&
      fromDelegationContractDocumentV2(input.revocationContract),
    stamps: fromDelegationStampsV2(input.stamps),
    activationSignedContract:
      input.activationSignedContract &&
      fromDelegationSignedContractDocumentV2(input.activationSignedContract),
    revocationSignedContract:
      input.revocationSignedContract &&
      fromDelegationSignedContractDocumentV2(input.revocationSignedContract),
  };
};
