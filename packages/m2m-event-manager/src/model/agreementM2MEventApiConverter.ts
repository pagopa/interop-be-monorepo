import { m2mEventApi } from "pagopa-interop-api-clients";
import {
  AgreementM2MEvent,
  AgreementM2MEventType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiAgreementM2MEventType(
  eventType: AgreementM2MEventType
): m2mEventApi.AgreementM2MEvent["eventType"] {
  return match<
    AgreementM2MEventType,
    m2mEventApi.AgreementM2MEvent["eventType"]
  >(eventType)
    .with("AgreementAdded", () => "AGREEMENT_ADDED")
    .with("DraftAgreementUpdated", () => "DRAFT_AGREEMENT_UPDATED")
    .with("AgreementDeleted", () => "AGREEMENT_DELETED")
    .with("AgreementActivated", () => "AGREEMENT_ACTIVATED")
    .with("AgreementRejected", () => "AGREEMENT_REJECTED")
    .with("AgreementUpgraded", () => "AGREEMENT_UPGRADED")
    .with("AgreementSubmitted", () => "AGREEMENT_SUBMITTED")
    .with("AgreementArchivedByConsumer", () => "AGREEMENT_ARCHIVED_BY_CONSUMER")
    .with(
      "AgreementSuspendedByConsumer",
      () => "AGREEMENT_SUSPENDED_BY_CONSUMER"
    )
    .with(
      "AgreementUnsuspendedByConsumer",
      () => "AGREEMENT_UNSUSPENDED_BY_CONSUMER"
    )
    .with(
      "AgreementSuspendedByProducer",
      () => "AGREEMENT_SUSPENDED_BY_PRODUCER"
    )
    .with(
      "AgreementUnsuspendedByProducer",
      () => "AGREEMENT_UNSUSPENDED_BY_PRODUCER"
    )
    .with(
      "AgreementSuspendedByPlatform",
      () => "AGREEMENT_SUSPENDED_BY_PLATFORM"
    )
    .with(
      "AgreementUnsuspendedByPlatform",
      () => "AGREEMENT_UNSUSPENDED_BY_PLATFORM"
    )
    .with("AgreementArchivedByUpgrade", () => "AGREEMENT_ARCHIVED_BY_UPGRADE")
    .with(
      "AgreementConsumerDocumentAdded",
      () => "AGREEMENT_CONSUMER_DOCUMENT_ADDED"
    )
    .with(
      "AgreementConsumerDocumentRemoved",
      () => "AGREEMENT_CONSUMER_DOCUMENT_REMOVED"
    )
    .with(
      "AgreementArchivedByRevokedDelegation",
      () => "AGREEMENT_ARCHIVED_BY_REVOKED_DELEGATION"
    )
    .with(
      "AgreementDeletedByRevokedDelegation",
      () => "AGREEMENT_DELETED_BY_REVOKED_DELEGATION"
    )
    .with(
      "AgreementSetMissingCertifiedAttributesByPlatform",
      () => "AGREEMENT_SET_MISSING_CERTIFIED_ATTRIBUTES_BY_PLATFORM"
    )
    .with(
      "AgreementSetDraftByPlatform",
      () => "AGREEMENT_SET_DRAFT_BY_PLATFORM"
    )
    .with(
      "AgreementSignedContractGenerated",
      () => "AGREEMENT_SIGNED_CONTRACT_GENERATED"
    )
    .exhaustive();
}

function toApiAgreementM2MEvent(
  event: AgreementM2MEvent
): m2mEventApi.AgreementM2MEvent {
  return {
    id: event.id,
    eventType: toApiAgreementM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    agreementId: event.agreementId,
    consumerDelegationId: event.consumerDelegationId,
    producerDelegationId: event.producerDelegationId,
  };
}

export function toApiAgreementM2MEvents(
  events: AgreementM2MEvent[]
): m2mEventApi.AgreementM2MEvents {
  return {
    events: events.map(toApiAgreementM2MEvent),
  };
}
