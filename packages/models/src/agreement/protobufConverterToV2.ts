import { match } from "ts-pattern";
import {
  AgreementDocumentV2,
  AgreementStampV2,
  AgreementStampsV2,
  AgreementStateV2,
  AgreementV2,
} from "../gen/v2/agreement/agreement.js";
import {
  Agreement,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
} from "./agreement.js";

export const toAgreementStateV2 = (state: AgreementState): AgreementStateV2 =>
  match(state)
    .with("Draft", () => AgreementStateV2.DRAFT)
    .with("Suspended", () => AgreementStateV2.SUSPENDED)
    .with("Archived", () => AgreementStateV2.ARCHIVED)
    .with("Pending", () => AgreementStateV2.PENDING)
    .with("Active", () => AgreementStateV2.ACTIVE)
    .with("Rejected", () => AgreementStateV2.REJECTED)
    .with(
      "MissingCertifiedAttributes",
      () => AgreementStateV2.MISSING_CERTIFIED_ATTRIBUTES
    )
    .exhaustive();

export const toAgreementDocumentV2 = (
  input: AgreementDocument
): AgreementDocumentV2 => ({
  ...input,
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toAgreementStampV2 = (
  input: AgreementStamp
): AgreementStampV2 => ({
  ...input,
  when: BigInt(input.when.getTime()),
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
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: input.updatedAt ? BigInt(input.updatedAt.getTime()) : undefined,
  suspendedAt: input.suspendedAt
    ? BigInt(input.suspendedAt.getTime())
    : undefined,
  consumerDocuments: input.consumerDocuments.map(toAgreementDocumentV2),
  contract: input.contract ? toAgreementDocumentV2(input.contract) : undefined,
  stamps: toAgreementStampsV2(input.stamps),
});
