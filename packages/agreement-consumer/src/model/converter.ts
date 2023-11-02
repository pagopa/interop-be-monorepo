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
): PersistentAgreementState => {
  switch (input) {
    case AgreementStateV1.ACTIVE:
      return persistentAgreementState.active;
    case AgreementStateV1.SUSPENDED:
      return persistentAgreementState.suspended;
    case AgreementStateV1.ARCHIVED:
      return persistentAgreementState.archived;
    case AgreementStateV1.DRAFT:
      return persistentAgreementState.draft;
    case AgreementStateV1.PENDING:
      return persistentAgreementState.pending;
    case AgreementStateV1.MISSING_CERTIFIED_ATTRIBUTES:
      return persistentAgreementState.missingCertifiedAttributes;
    case AgreementStateV1.REJECTED:
      return persistentAgreementState.rejected;
    case AgreementStateV1.UNSPECIFIED$:
      throw new Error("Unspecified agreement state");
  }
};

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
