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
  ...(input?.submission && {
    submission: fromAgreementStampV1(input.submission),
  }),
  ...(input?.activation && {
    activation: fromAgreementStampV1(input.activation),
  }),
  ...(input?.rejection && { rejection: fromAgreementStampV1(input.rejection) }),
  ...(input?.suspensionByProducer && {
    suspensionByProducer: fromAgreementStampV1(input.suspensionByProducer),
  }),
  ...(input?.suspensionByConsumer && {
    suspensionByConsumer: fromAgreementStampV1(input.suspensionByConsumer),
  }),
  ...(input?.upgrade && { upgrade: fromAgreementStampV1(input.upgrade) }),
  ...(input?.archiving && { archiving: fromAgreementStampV1(input.archiving) }),
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
  id: unsafeBrandId(input.id),
  eserviceId: unsafeBrandId(input.eserviceId),
  descriptorId: unsafeBrandId(input.descriptorId),
  producerId: unsafeBrandId(input.producerId),
  consumerId: unsafeBrandId(input.consumerId),
  state: fromAgreementStateV1(input.state),
  verifiedAttributes: input.verifiedAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  certifiedAttributes: input.certifiedAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  declaredAttributes: input.declaredAttributes.map((a) => ({
    ...a,
    id: unsafeBrandId(a.id),
  })),
  ...(input.suspendedByConsumer !== undefined && {
    suspendedByConsumer: input.suspendedByConsumer,
  }),
  ...(input.suspendedByProducer !== undefined && {
    suspendedByProducer: input.suspendedByProducer,
  }),
  ...(input.suspendedByPlatform !== undefined && {
    suspendedByPlatform: input.suspendedByPlatform,
  }),
  createdAt: bigIntToDate(input.createdAt),
  ...(input.updatedAt && { updatedAt: bigIntToDate(input.updatedAt) }),
  ...(input.consumerNotes && { consumerNotes: input.consumerNotes }),
  consumerDocuments: input.consumerDocuments.map(fromAgreementDocumentV1),
  ...(input.contract && { contract: fromAgreementDocumentV1(input.contract) }),
  stamps: fromAgreementStampsV1(input.stamps),
  ...(input.rejectionReason && { rejectionReason: input.rejectionReason }),
  ...(input.suspendedAt && { suspendedAt: bigIntToDate(input.suspendedAt) }),
});
