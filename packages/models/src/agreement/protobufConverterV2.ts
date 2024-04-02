import { unsafeBrandId } from "../brandedIds.js";
import {
  AgreementDocumentV2,
  AgreementStampV2,
  AgreementStampsV2,
  AgreementStateV2,
  AgreementV2,
} from "../gen/v2/agreement/agreement.js";
import {
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  agreementState,
  Agreement,
} from "./agreement.js";

export const fromAgreementDocumentV2 = (
  input: AgreementDocumentV2
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(Number(input.createdAt)),
});

export const fromAgreementStampV2 = (
  input: AgreementStampV2 | undefined
): AgreementStamp | undefined =>
  input
    ? {
        ...input,
        when: new Date(Number(input.when)),
      }
    : undefined;

export const fromAgreementStampsV2 = (
  input: AgreementStampsV2 | undefined
): AgreementStamps | undefined =>
  input
    ? {
        ...input,
        submission: fromAgreementStampV2(input.submission),
        activation: fromAgreementStampV2(input.activation),
        rejection: fromAgreementStampV2(input.rejection),
        suspensionByProducer: fromAgreementStampV2(input.suspensionByProducer),
        suspensionByConsumer: fromAgreementStampV2(input.suspensionByConsumer),
        upgrade: fromAgreementStampV2(input.upgrade),
        archiving: fromAgreementStampV2(input.archiving),
      }
    : undefined;

export const fromAgreementStateV2 = (
  input: AgreementStateV2
): AgreementState => {
  switch (input) {
    case AgreementStateV2.ACTIVE:
      return agreementState.active;
    case AgreementStateV2.SUSPENDED:
      return agreementState.suspended;
    case AgreementStateV2.ARCHIVED:
      return agreementState.archived;
    case AgreementStateV2.DRAFT:
      return agreementState.draft;
    case AgreementStateV2.PENDING:
      return agreementState.pending;
    case AgreementStateV2.MISSING_CERTIFIED_ATTRIBUTES:
      return agreementState.missingCertifiedAttributes;
    case AgreementStateV2.REJECTED:
      return agreementState.rejected;
  }
};

export const fromAgreementV2 = (input: AgreementV2): Agreement => ({
  ...input,
  id: unsafeBrandId(input.id),
  eserviceId: unsafeBrandId(input.eserviceId),
  descriptorId: unsafeBrandId(input.descriptorId),
  producerId: unsafeBrandId(input.producerId),
  consumerId: unsafeBrandId(input.consumerId),
  certifiedAttributes: input.certifiedAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  declaredAttributes: input.declaredAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  verifiedAttributes: input.verifiedAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  state: fromAgreementStateV2(input.state),
  createdAt: new Date(Number(input.createdAt)),
  updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
  consumerDocuments: input.consumerDocuments.map(fromAgreementDocumentV2),
  contract: input.contract
    ? fromAgreementDocumentV2(input.contract)
    : undefined,
  stamps: { ...fromAgreementStampsV2(input.stamps) },
});
