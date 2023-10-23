import {
  AgreementDocumentV1,
  AgreementStateV1,
  AgreementV1,
  PersistentAgreement,
  PersistentAgreementDocument,
  PersistentAgreementState,
  persistentAgreementState,
  PersistentStamps,
  PersistentStamp,
  StampsV1,
  StampV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const fromDocumentV1 = (
  input: AgreementDocumentV1
): PersistentAgreementDocument => ({
  ...input,
  createdAt: new Date(Number(input.createdAt)),
});

export const fromAgreementStamp = (
  input: StampV1 | undefined
): PersistentStamp | undefined =>
  input
    ? {
        ...input,
        when: new Date(Number(input.when)),
      }
    : undefined;

export const fromAgreementStamps = (
  input: StampsV1 | undefined
): PersistentStamps | undefined =>
  input
    ? {
        ...input,
        submission: fromAgreementStamp(input.submission),
        activation: fromAgreementStamp(input.activation),
        rejection: fromAgreementStamp(input.rejection),
        suspensionByProducer: fromAgreementStamp(input.suspensionByProducer),
        suspensionByConsumer: fromAgreementStamp(input.suspensionByConsumer),
        upgrade: fromAgreementStamp(input.upgrade),
        archiving: fromAgreementStamp(input.archiving),
      }
    : undefined;

export const fromAgreementState = (
  input: AgreementStateV1
): PersistentAgreementState =>
  match(input)
    .with(AgreementStateV1.ACTIVE, () => persistentAgreementState.active)
    .with(AgreementStateV1.SUSPENDED, () => persistentAgreementState.suspended)
    .with(AgreementStateV1.ARCHIVED, () => persistentAgreementState.archived)
    .with(AgreementStateV1.PENDING, () => persistentAgreementState.pending)
    .with(
      AgreementStateV1.MISSING_CERTIFIED_ATTRIBUTES,
      () => persistentAgreementState.missingCertifiedAttributes
    )
    .with(AgreementStateV1.REJECTED, () => persistentAgreementState.rejected)
    .otherwise(() => persistentAgreementState.draft);

export const fromAgreementV1 = (input: AgreementV1): PersistentAgreement => ({
  ...input,
  state: fromAgreementState(input.state),
  createdAt: new Date(Number(input.createdAt)),
  updatedAt: new Date(Number(input.updatedAt)),
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
  consumerDocuments: input.consumerDocuments.map(fromDocumentV1),
  contract: input.contract ? fromDocumentV1(input.contract) : undefined,
  stamps: { ...fromAgreementStamps(input.stamps) },
});
