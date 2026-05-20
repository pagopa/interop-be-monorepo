import { CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocumentId,
  AgreementEventV2,
  AgreementSuspensionReason,
  AgreementSuspensionReasonV2,
  CertifiedDiscreteAttributeFailure,
  CorrelationId,
  DelegationId,
  WithMetadata,
  agreementSuspensionReason,
  toAgreementV2,
  toAttributeCertifiedDiscreteComparatorV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

const toAgreementSuspensionReasonV2 = (
  suspensionReason: AgreementSuspensionReason | undefined
): AgreementSuspensionReasonV2 | undefined =>
  match(suspensionReason)
    .with(undefined, () => undefined)
    .with(
      agreementSuspensionReason.certifiedAttribute,
      () =>
        AgreementSuspensionReasonV2.AGREEMENT_SUSPENSION_REASON_CERTIFIED_ATTRIBUTE
    )
    .with(
      agreementSuspensionReason.certifiedDiscreteAttribute,
      () =>
        AgreementSuspensionReasonV2.AGREEMENT_SUSPENSION_REASON_CERTIFIED_DISCRETE_ATTRIBUTE
    )
    .exhaustive();

const toCertifiedDiscreteAttributeFailureV2 = (
  failure: CertifiedDiscreteAttributeFailure
) => ({
  attributeId: failure.attributeId,
  tenantValue: failure.tenantValue,
  threshold: failure.threshold,
  comparator: toAttributeCertifiedDiscreteComparatorV2(failure.comparator),
});

export function toCreateEventAgreementDeleted(
  agreement: Agreement,
  version: number,
  correlationId: CorrelationId
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

export function toCreateEventAgreementDeletedByRevokedDelegation(
  agreement: Agreement,
  delegationId: DelegationId,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementDeletedByRevokedDelegation",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
        delegationId,
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementAdded(
  agreement: Agreement,
  correlationId: CorrelationId
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version: undefined,
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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

export function toCreateEventAgreementArchivedByRevokedDelegation(
  agreement: Agreement,
  delegationId: DelegationId,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementArchivedByRevokedDelegation",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
        delegationId,
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementArchivedByUpgrade(
  agreement: Agreement,
  version: number,
  correlationId: CorrelationId
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
  correlationId: CorrelationId
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version: undefined,
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId,
  suspensionReason?: AgreementSuspensionReason,
  discreteAttributeFailure?: CertifiedDiscreteAttributeFailure
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.id,
    version,
    event: {
      type: "AgreementSuspendedByPlatform",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement),
        suspensionReason: toAgreementSuspensionReasonV2(suspensionReason),
        discreteAttributeFailure: discreteAttributeFailure
          ? toCertifiedDiscreteAttributeFailureV2(discreteAttributeFailure)
          : undefined,
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementUnsuspendedByProducer(
  agreement: Agreement,
  version: number,
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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

export function toCreateEventAgreementDocumentGenerated(
  agreement: WithMetadata<Agreement>,
  correlationId: CorrelationId
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.data.id,
    version: agreement.metadata.version,
    event: {
      type: "AgreementContractGenerated",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventAgreementSignedContractGenerated(
  agreement: WithMetadata<Agreement>,
  correlationId: CorrelationId
): CreateEvent<AgreementEventV2> {
  return {
    streamId: agreement.data.id,
    version: agreement.metadata.version,
    event: {
      type: "AgreementSignedContractGenerated",
      event_version: 2,
      data: {
        agreement: toAgreementV2(agreement.data),
      },
    },
    correlationId,
  };
}
