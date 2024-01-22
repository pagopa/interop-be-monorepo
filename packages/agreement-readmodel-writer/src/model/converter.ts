import {
  Agreement,
  AgreementDocument,
  AgreementDocumentV1,
  AgreementState,
  AgreementStateV1,
  AgreementV1,
  StampV1,
  AgreementStamp,
  StampsV1,
  AgreementStamps,
  agreementState,
  unsafeBrandId,
} from "pagopa-interop-models";

export const fromDocumentV1 = (
  input: AgreementDocumentV1
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(Number(input.createdAt)),
});

export const fromAgreementStamp = (
  input: StampV1 | undefined
): AgreementStamp | undefined =>
  input
    ? {
        ...input,
        when: new Date(Number(input.when)),
      }
    : undefined;

export const fromAgreementStamps = (
  input: StampsV1 | undefined
): AgreementStamps | undefined =>
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

export const fromAgreementState = (input: AgreementStateV1): AgreementState => {
  switch (input) {
    case AgreementStateV1.ACTIVE:
      return agreementState.active;
    case AgreementStateV1.SUSPENDED:
      return agreementState.suspended;
    case AgreementStateV1.ARCHIVED:
      return agreementState.archived;
    case AgreementStateV1.DRAFT:
      return agreementState.draft;
    case AgreementStateV1.PENDING:
      return agreementState.pending;
    case AgreementStateV1.MISSING_CERTIFIED_ATTRIBUTES:
      return agreementState.missingCertifiedAttributes;
    case AgreementStateV1.REJECTED:
      return agreementState.rejected;
    case AgreementStateV1.UNSPECIFIED$:
      throw new Error("Unspecified agreement state");
  }
};

export const fromAgreementV1 = (input: AgreementV1): Agreement => ({
  ...input,
  id: unsafeBrandId(input.id),
  descriptorId: unsafeBrandId(input.descriptorId),
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
  state: fromAgreementState(input.state),
  createdAt: new Date(Number(input.createdAt)),
  updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
  consumerDocuments: input.consumerDocuments.map(fromDocumentV1),
  contract: input.contract ? fromDocumentV1(input.contract) : undefined,
  stamps: { ...fromAgreementStamps(input.stamps) },
});
