import { CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  AgreementV2,
  AgreementDocumentId,
  AgreementStateV2,
  AgreementDocumentV2,
  AgreementStampV2,
  AgreementStampsV2,
  AgreementEventV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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
): CreateEvent<AgreementEventV2> {
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
): CreateEvent<AgreementEventV2> {
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
): CreateEvent<AgreementEventV2> {
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

export function toCreateEventAgreementSubmitted(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementArchived(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementArchivedByUpgrade(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementUpgraded(
  agreement: Agreement,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version: 0,
    event: {
      type: "AgreementUpgraded",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementRejected(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementActivated(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementSuspendedByProducer(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementSuspendedByConsumer(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementUnsuspendedByProducer(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementUnsuspendedByConsumer(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
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
    correlationId,
  };
}

export function toCreateEventAgreementConsumerDocumentAdded(
  documentId: AgreementDocumentId,
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementConsumerDocumentAdded",
      event_version: 2,
      data: {
        documentId,
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementConsumerDocumentRemoved(
  documentId: AgreementDocumentId,
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementConsumerDocumentRemoved",
      event_version: 2,
      data: {
        documentId,
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}
