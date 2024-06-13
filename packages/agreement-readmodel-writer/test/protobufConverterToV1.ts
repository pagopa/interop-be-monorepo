import {
  AgreementDocumentV1,
  AgreementStateV1,
  AgreementV1,
  AgreementState,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  StampsV1,
  StampV1,
  Agreement,
  dateToBigInt,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const toAgreementStateV1 = (state: AgreementState): AgreementStateV1 =>
  match(state)
    .with("Draft", () => AgreementStateV1.DRAFT)
    .with("Suspended", () => AgreementStateV1.SUSPENDED)
    .with("Archived", () => AgreementStateV1.ARCHIVED)
    .with("Pending", () => AgreementStateV1.PENDING)
    .with("Active", () => AgreementStateV1.ACTIVE)
    .with("Rejected", () => AgreementStateV1.REJECTED)
    .with(
      "MissingCertifiedAttributes",
      () => AgreementStateV1.MISSING_CERTIFIED_ATTRIBUTES
    )
    .exhaustive();

export const toAgreementDocumentV1 = (
  input: AgreementDocument
): AgreementDocumentV1 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toStampV1 = (input: AgreementStamp): StampV1 => ({
  ...input,
  when: dateToBigInt(input.when),
});

export const toStampsV1 = (input: AgreementStamps): StampsV1 => ({
  submission: input.submission ? toStampV1(input.submission) : undefined,
  activation: input.activation ? toStampV1(input.activation) : undefined,
  rejection: input.rejection ? toStampV1(input.rejection) : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? toStampV1(input.suspensionByProducer)
    : undefined,
  upgrade: input.upgrade ? toStampV1(input.upgrade) : undefined,
  archiving: input.archiving ? toStampV1(input.archiving) : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? toStampV1(input.suspensionByConsumer)
    : undefined,
});

export const toAgreementV1 = (input: Agreement): AgreementV1 => ({
  ...input,
  state: toAgreementStateV1(input.state),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  consumerDocuments: input.consumerDocuments.map(toAgreementDocumentV1),
  contract: input.contract ? toAgreementDocumentV1(input.contract) : undefined,
  stamps: toStampsV1(input.stamps),
});
