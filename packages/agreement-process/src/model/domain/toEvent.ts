import { CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocumentId,
  AgreementEventV2,
  toAgreementV2,
} from "pagopa-interop-models";

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

export function toCreateEventAgreementArchivedByConsumer(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementArchivedByConsumer",
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

export function toCreateEventAgreementSuspendedByPlatform(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSuspendedByPlatform",
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

export function toCreateEventAgreementUnsuspendedByPlatform(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementUnsuspendedByPlatform",
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

export function toCreateEventAgreementSetDraftByPlatform(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSetDraftByPlatform",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementSetMissingCertifiedAttributesByPlatform(
  agreement: Agreement,
  version: number,
  correlationId: string
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSetMissingCertifiedAttributesByPlatform",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
      },
    },
    correlationId,
  };
}
