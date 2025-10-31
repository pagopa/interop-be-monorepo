import { match } from "ts-pattern";
import {
  AgreementDocumentV2,
  AgreementStampV2,
  AgreementStampsV2,
  AgreementStateV2,
  AgreementV2,
} from "../gen/v2/agreement/agreement.js";
import { dateToBigInt } from "../utils.js";
import {
  Agreement,
  AgreementContract,
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

export const toAgreementContractV2 = (
  input: AgreementContract
): AgreementDocumentV2 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
  signedAt: dateToBigInt(input.signedAt),
});

export const toAgreementStampV2 = (
  input: AgreementStamp
): AgreementStampV2 => ({
  ...input,
  when: dateToBigInt(input.when),
});

export const toAgreementStampsV2 = (
  input: AgreementStamps
): AgreementStampsV2 => ({
  submission: input.submission
    ? toAgreementStampV2(input.submission)
    : undefined,
  activation: input.activation
    ? toAgreementStampV2(input.activation)
    : undefined,
  rejection: input.rejection ? toAgreementStampV2(input.rejection) : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? toAgreementStampV2(input.suspensionByProducer)
    : undefined,
  upgrade: input.upgrade ? toAgreementStampV2(input.upgrade) : undefined,
  archiving: input.archiving ? toAgreementStampV2(input.archiving) : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? toAgreementStampV2(input.suspensionByConsumer)
    : undefined,
});

export const toAgreementV2 = (input: Agreement): AgreementV2 => ({
  ...input,
  state: toAgreementStateV2(input.state),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  consumerDocuments: input.consumerDocuments.map(toAgreementDocumentV2),
  contract: input.contract ? toAgreementContractV2(input.contract) : undefined,
  stamps: toAgreementStampsV2(input.stamps),
});
