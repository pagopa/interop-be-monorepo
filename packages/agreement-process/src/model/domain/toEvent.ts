import { CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentV1,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  AgreementStateV1,
  AgreementV1,
  AgreementV2,
  StampV1,
  StampsV1,
  AgreementId,
  AgreementDocumentId,
  AgreementEvent,
  AgreementStateV2,
  AgreementDocumentV2,
  AgreementStampV2,
  AgreementStampsV2,
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
  createdAt: BigInt(input.createdAt.getTime()),
});

export const toStampV1 = (input: AgreementStamp): StampV1 => ({
  ...input,
  when: BigInt(input.when.getTime()),
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
  createdAt: BigInt(input.createdAt.getTime()),
  updatedAt: input.updatedAt ? BigInt(input.updatedAt.getTime()) : undefined,
  suspendedAt: input.suspendedAt
    ? BigInt(input.suspendedAt.getTime())
    : undefined,
  consumerDocuments: input.consumerDocuments.map(toAgreementDocumentV1),
  contract: input.contract ? toAgreementDocumentV1(input.contract) : undefined,
  stamps: toStampsV1(input.stamps),
});

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

export function toCreateEventAgreementDeleted(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementDeleted",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementAdded(
  agreement: Agreement,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version: 0,
    event: {
      type: "AgreementAdded",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventDraftAgreementUpdated(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "DraftAgreementUpdated",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementUpdated(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementUpdated",
      event_version: 1,
      data: {
        agreement: toAgreementV1(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementContractAdded(
  agreementId: AgreementId,
  agreementDocument: AgreementDocument,
  version: number,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementContractAdded",
      event_version: 1,
      data: {
        agreementId,
        contract: toAgreementDocumentV1(agreementDocument),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementConsumerDocumentAdded(
  agreementId: AgreementId,
  agreementDocument: AgreementDocument,
  version: number,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementConsumerDocumentAdded",
      event_version: 1,
      data: {
        agreementId,
        document: toAgreementDocumentV1(agreementDocument),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementConsumerDocumentRemoved(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  version: number,
  correlationId: string
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementConsumerDocumentRemoved",
      event_version: 1,
      data: {
        agreementId,
        documentId,
      },
    },
    correlationId,
  };
}
