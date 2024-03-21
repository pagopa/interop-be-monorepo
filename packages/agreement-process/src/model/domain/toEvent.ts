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
  StampV2,
  StampsV2,
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

export const toStampV2 = (input: AgreementStamp): StampV2 => ({
  ...input,
  when: BigInt(input.when.getTime()),
});

export const toStampsV2 = (input: AgreementStamps): StampsV2 => ({
  submission: input.submission ? toStampV2(input.submission) : undefined,
  activation: input.activation ? toStampV2(input.activation) : undefined,
  rejection: input.rejection ? toStampV2(input.rejection) : undefined,
  suspensionByProducer: input.suspensionByProducer
    ? toStampV2(input.suspensionByProducer)
    : undefined,
  upgrade: input.upgrade ? toStampV2(input.upgrade) : undefined,
  archiving: input.archiving ? toStampV2(input.archiving) : undefined,
  suspensionByConsumer: input.suspensionByConsumer
    ? toStampV2(input.suspensionByConsumer)
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
  stamps: toStampsV2(input.stamps),
});

export function toCreateEventAgreementDeleted(
  agreement: Agreement,
  version: number
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
  };
}

export function toCreateEventAgreementAdded(
  agreement: Agreement
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
  };
}

export function toCreateEventDraftAgreementUpdated(
  agreement: Agreement,
  version: number
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
  };
}

export function toCreateEventAgreementSubmited(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSubmitted",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementArchived(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementArchived",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementRejected(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementRejected",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementActivated(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementActivated",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementSuspendedByProducer(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSuspendedByProducer",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementSuspendedByConsumer(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSuspendedByConsumer",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementUnsuspendedByProducer(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementUnsuspendedByProducer",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementUnsuspendedByConsumer(
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementUnsuspendedByConsumer",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementConsumerDocumentAdded(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementConsumerDocumentAdded",
      event_version: 2,
      data: {
        documentId,
        agreement: toAgreementV2(agreement),
      },
    },
  };
}

export function toCreateEventAgreementConsumerDocumentRemoved(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  agreement: Agreement,
  version: number
): CreateEvent<AgreementEvent> {
  return {
    streamId: agreementId,
    version,
    event: {
      type: "AgreementConsumerDocumentRemoved",
      event_version: 2,
      data: {
        documentId,
        agreement: toAgreementV2(agreement),
      },
    },
  };
}
