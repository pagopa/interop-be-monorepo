import { DelegationId, unsafeBrandId } from "../brandedIds.js";
import {
  AgreementDocumentV2,
  AgreementStampV2,
  AgreementStampsV2,
  AgreementStateV2,
  AgreementV2,
} from "../gen/v2/agreement/agreement.js";
import { bigIntToDate } from "../utils.js";
import {
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  agreementState,
  Agreement,
  AgreementContract,
} from "./agreement.js";

export const fromAgreementDocumentV2 = (
  input: AgreementDocumentV2
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
});
export const fromAgreementContractV2 = (
  input: AgreementDocumentV2
): AgreementContract => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: bigIntToDate(input.createdAt),
  signedAt: bigIntToDate(input.signedAt),
});

export const fromAgreementStampV2 = (
  input: AgreementStampV2 | undefined
): AgreementStamp | undefined =>
  input
    ? {
        who: unsafeBrandId(input.who),
        when: bigIntToDate(input.when),
        delegationId: input.delegationId
          ? unsafeBrandId<DelegationId>(input.delegationId)
          : undefined,
      }
    : undefined;

export const fromAgreementStampsV2 = (
  input: AgreementStampsV2 | undefined
): AgreementStamps => ({
  submission: fromAgreementStampV2(input?.submission),
  activation: fromAgreementStampV2(input?.activation),
  rejection: fromAgreementStampV2(input?.rejection),
  suspensionByProducer: fromAgreementStampV2(input?.suspensionByProducer),
  suspensionByConsumer: fromAgreementStampV2(input?.suspensionByConsumer),
  upgrade: fromAgreementStampV2(input?.upgrade),
  archiving: fromAgreementStampV2(input?.archiving),
});

export const fromAgreementStateV2 = (
  input: AgreementStateV2
): AgreementState => {
  switch (input) {
    case AgreementStateV2.ACTIVE:
      return agreementState.active;
    case AgreementStateV2.SUSPENDED:
      return agreementState.suspended;
    case AgreementStateV2.ARCHIVED:
      return agreementState.archived;
    case AgreementStateV2.DRAFT:
      return agreementState.draft;
    case AgreementStateV2.PENDING:
      return agreementState.pending;
    case AgreementStateV2.MISSING_CERTIFIED_ATTRIBUTES:
      return agreementState.missingCertifiedAttributes;
    case AgreementStateV2.REJECTED:
      return agreementState.rejected;
  }
};

export const fromAgreementV2 = (input: AgreementV2): Agreement => ({
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
  state: fromAgreementStateV2(input.state),
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
  suspendedAt: bigIntToDate(input.suspendedAt),
  consumerDocuments: input.consumerDocuments.map(fromAgreementDocumentV2),
  contract: input.contract
    ? fromAgreementContractV2(input.contract)
    : undefined,
  stamps: fromAgreementStampsV2(input.stamps),
});
