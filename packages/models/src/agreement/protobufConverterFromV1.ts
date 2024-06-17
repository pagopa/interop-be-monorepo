import { unsafeBrandId } from "../brandedIds.js";
import {
  AgreementDocumentV1,
  StampV1,
  StampsV1,
  AgreementStateV1,
  AgreementV1,
} from "../gen/v1/agreement/agreement.js";
import { bigIntToDate } from "../utils.js";
import {
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  agreementState,
  Agreement,
} from "./agreement.js";

export const fromAgreementDocumentV1 = (
  input: AgreementDocumentV1
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
});

export const fromAgreementStampV1 = (
  input: StampV1 | undefined
): AgreementStamp | undefined =>
  input
    ? {
        who: unsafeBrandId(input.who),
        when: bigIntToDate(input.when),
      }
    : undefined;

export const fromAgreementStampsV1 = (
  input: StampsV1 | undefined
): AgreementStamps => ({
  ...input,
  submission: input?.submission
    ? fromAgreementStampV1(input.submission)
    : undefined,
  activation: input?.activation
    ? fromAgreementStampV1(input.activation)
    : undefined,
  rejection: input?.rejection
    ? fromAgreementStampV1(input.rejection)
    : undefined,
  suspensionByProducer: input?.suspensionByProducer
    ? fromAgreementStampV1(input.suspensionByProducer)
    : undefined,
  suspensionByConsumer: input?.suspensionByConsumer
    ? fromAgreementStampV1(input.suspensionByConsumer)
    : undefined,
  upgrade: input?.upgrade ? fromAgreementStampV1(input.upgrade) : undefined,
  archiving: input?.archiving
    ? fromAgreementStampV1(input.archiving)
    : undefined,
});

export const fromAgreementStateV1 = (
  input: AgreementStateV1
): AgreementState => {
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
  state: fromAgreementStateV1(input.state),
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
  suspendedAt: bigIntToDate(input.suspendedAt),
  consumerDocuments: input.consumerDocuments.map(fromAgreementDocumentV1),
  contract: input.contract
    ? fromAgreementDocumentV1(input.contract)
    : undefined,
  stamps: fromAgreementStampsV1(input.stamps),
});
