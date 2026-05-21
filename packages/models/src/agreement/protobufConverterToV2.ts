import { match } from "ts-pattern";
import {
  AgreementDocumentV2,
  AgreementSignedContractV2,
  AgreementStampV2,
  AgreementStampsV2,
  AgreementStateV2,
  AgreementV2,
} from "../gen/v2/agreement/agreement.js";
import { dateToBigInt } from "../utils.js";
import {
  Agreement,
  AgreementSignedContract,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  agreementState,
} from "./agreement.js";

export const toAgreementStateV2 = (state: AgreementState): AgreementStateV2 =>
  match(state)
    .with(agreementState.draft, () => AgreementStateV2.DRAFT)
    .with(agreementState.suspended, () => AgreementStateV2.SUSPENDED)
    .with(agreementState.archived, () => AgreementStateV2.ARCHIVED)
    .with(agreementState.pending, () => AgreementStateV2.PENDING)
    .with(agreementState.active, () => AgreementStateV2.ACTIVE)
    .with(agreementState.rejected, () => AgreementStateV2.REJECTED)
    .with(
      agreementState.missingCertifiedAttributes,
      () => AgreementStateV2.MISSING_CERTIFIED_ATTRIBUTES
    )
    .exhaustive();

export const toAgreementDocumentV2 = (
  input: AgreementDocument
): AgreementDocumentV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toAgreementSignedContractV2 = (
  input: AgreementSignedContract
): AgreementSignedContractV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
  signedAt: dateToBigInt(input.signedAt),
});

export const toAgreementStampV2 = (
  input: AgreementStamp
): AgreementStampV2 => ({
  who: input.who,
  when: dateToBigInt(input.when),
  ...(input.delegationId !== undefined && {
    delegationId: input.delegationId,
  }),
});

export const toAgreementStampsV2 = (
  input: AgreementStamps
): AgreementStampsV2 => ({
  ...(input.submission !== undefined && {
    submission: toAgreementStampV2(input.submission),
  }),
  ...(input.activation !== undefined && {
    activation: toAgreementStampV2(input.activation),
  }),
  ...(input.rejection !== undefined && {
    rejection: toAgreementStampV2(input.rejection),
  }),
  ...(input.suspensionByProducer !== undefined && {
    suspensionByProducer: toAgreementStampV2(input.suspensionByProducer),
  }),
  ...(input.upgrade !== undefined && {
    upgrade: toAgreementStampV2(input.upgrade),
  }),
  ...(input.archiving !== undefined && {
    archiving: toAgreementStampV2(input.archiving),
  }),
  ...(input.suspensionByConsumer !== undefined && {
    suspensionByConsumer: toAgreementStampV2(input.suspensionByConsumer),
  }),
});

export const toAgreementV2 = (input: Agreement): AgreementV2 => ({
  id: input.id,
  eserviceId: input.eserviceId,
  descriptorId: input.descriptorId,
  producerId: input.producerId,
  consumerId: input.consumerId,
  state: toAgreementStateV2(input.state),
  verifiedAttributes: input.verifiedAttributes,
  certifiedAttributes: input.certifiedAttributes,
  certifiedDiscreteAttributes: input.certifiedDiscreteAttributes,
  declaredAttributes: input.declaredAttributes,
  ...(input.suspendedByConsumer !== undefined && {
    suspendedByConsumer: input.suspendedByConsumer,
  }),
  ...(input.suspendedByProducer !== undefined && {
    suspendedByProducer: input.suspendedByProducer,
  }),
  createdAt: dateToBigInt(input.createdAt),
  ...(input.updatedAt !== undefined && {
    updatedAt: dateToBigInt(input.updatedAt),
  }),
  ...(input.suspendedByPlatform !== undefined && {
    suspendedByPlatform: input.suspendedByPlatform,
  }),
  consumerDocuments: input.consumerDocuments.map(toAgreementDocumentV2),
  ...(input.consumerNotes !== undefined && {
    consumerNotes: input.consumerNotes,
  }),
  ...(input.contract !== undefined && {
    contract: toAgreementDocumentV2(input.contract),
  }),
  stamps: toAgreementStampsV2(input.stamps),
  ...(input.rejectionReason !== undefined && {
    rejectionReason: input.rejectionReason,
  }),
  ...(input.suspendedAt !== undefined && {
    suspendedAt: dateToBigInt(input.suspendedAt),
  }),
  ...(input.signedContract !== undefined && {
    signedContract: toAgreementSignedContractV2(input.signedContract),
  }),
});
