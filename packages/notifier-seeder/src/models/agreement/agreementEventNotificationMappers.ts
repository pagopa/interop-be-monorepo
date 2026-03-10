import { match } from "ts-pattern";
import {
  Agreement,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  agreementState,
} from "pagopa-interop-models";
import {
  AgreementDocumentV1Notification,
  AgreementStampV1Notification,
  AgreementStampsV1Notification,
  AgreementV1Notification,
} from "./agreementEventNotification.js";

const toAgreementStateV1Notification = (input: AgreementState): string =>
  match(input)
    .with(agreementState.draft, () => "Draft")
    .with(agreementState.suspended, () => "Suspended")
    .with(agreementState.archived, () => "Archived")
    .with(agreementState.pending, () => "Pending")
    .with(agreementState.active, () => "Active")
    .with(
      agreementState.missingCertifiedAttributes,
      () => "MissingCertifiedAttributes"
    )
    .with(agreementState.rejected, () => "Rejected")
    .exhaustive();

const toAgreementDocumentV1Notification = (
  input: AgreementDocument
): AgreementDocumentV1Notification => ({
  ...input,
  createdAt: input.createdAt.toISOString(),
});

const toAgreementStampsV1Notification = (
  input: AgreementStamps
): AgreementStampsV1Notification => ({
  submission: input.submission
    ? toAgreementStampV1Notification(input.submission)
    : undefined,
  activation: input.activation
    ? toAgreementStampV1Notification(input.activation)
    : undefined,
  rejection: input.rejection
    ? toAgreementStampV1Notification(input.rejection)
    : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? toAgreementStampV1Notification(input.suspensionByProducer)
    : undefined,
  upgrade: input.upgrade
    ? toAgreementStampV1Notification(input.upgrade)
    : undefined,
  archiving: input.archiving
    ? toAgreementStampV1Notification(input.archiving)
    : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? toAgreementStampV1Notification(input.suspensionByConsumer)
    : undefined,
});

const toAgreementStampV1Notification = (
  input: AgreementStamp
): AgreementStampV1Notification => ({
  ...input,
  when: input.when.toISOString(),
});

export const toAgreementV1Notification = (
  input: Agreement
): AgreementV1Notification => ({
  ...input,
  state: toAgreementStateV1Notification(input.state),
  createdAt: input.createdAt.toISOString(),
  updatedAt: input.updatedAt?.toISOString(),
  consumerDocuments: input.consumerDocuments.map(
    toAgreementDocumentV1Notification
  ),
  contract: input.contract
    ? toAgreementDocumentV1Notification(input.contract)
    : undefined,
  stamps: toAgreementStampsV1Notification(input.stamps),
  suspendedAt: input.suspendedAt?.toISOString(),
});
