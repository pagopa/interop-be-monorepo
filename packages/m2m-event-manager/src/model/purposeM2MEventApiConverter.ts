import { m2mEventApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { PurposeM2MEvent, PurposeM2MEventType } from "pagopa-interop-models";

function toApiPurposeM2MEventType(
  eventType: PurposeM2MEventType
): m2mEventApi.PurposeM2MEvent["eventType"] {
  return match<PurposeM2MEventType, m2mEventApi.PurposeM2MEvent["eventType"]>(
    eventType
  )
    .with("DraftPurposeDeleted", () => "DRAFT_PURPOSE_DELETED")
    .with(
      "WaitingForApprovalPurposeDeleted",
      () => "WAITING_FOR_APPROVAL_PURPOSE_DELETED"
    )
    .with(
      "PurposeDeletedByRevokedDelegation",
      () => "PURPOSE_DELETED_BY_REVOKED_DELEGATION"
    )
    .with("PurposeAdded", () => "PURPOSE_ADDED")
    .with("DraftPurposeUpdated", () => "DRAFT_PURPOSE_UPDATED")
    .with("NewPurposeVersionActivated", () => "NEW_PURPOSE_VERSION_ACTIVATED")
    .with(
      "NewPurposeVersionWaitingForApproval",
      () => "NEW_PURPOSE_VERSION_WAITING_FOR_APPROVAL"
    )
    .with("PurposeActivated", () => "PURPOSE_ACTIVATED")
    .with("PurposeArchived", () => "PURPOSE_ARCHIVED")
    .with(
      "PurposeVersionOverQuotaUnsuspended",
      () => "PURPOSE_VERSION_OVER_QUOTA_UNSUSPENDED"
    )
    .with("PurposeVersionRejected", () => "PURPOSE_VERSION_REJECTED")
    .with(
      "PurposeVersionSuspendedByConsumer",
      () => "PURPOSE_VERSION_SUSPENDED_BY_CONSUMER"
    )
    .with(
      "PurposeVersionSuspendedByProducer",
      () => "PURPOSE_VERSION_SUSPENDED_BY_PRODUCER"
    )
    .with(
      "PurposeVersionUnsuspendedByConsumer",
      () => "PURPOSE_VERSION_UNSUSPENDED_BY_CONSUMER"
    )
    .with(
      "PurposeVersionUnsuspendedByProducer",
      () => "PURPOSE_VERSION_UNSUSPENDED_BY_PRODUCER"
    )
    .with("PurposeWaitingForApproval", () => "PURPOSE_WAITING_FOR_APPROVAL")
    .with(
      "WaitingForApprovalPurposeVersionDeleted",
      () => "WAITING_FOR_APPROVAL_PURPOSE_VERSION_DELETED"
    )
    .with("PurposeVersionActivated", () => "PURPOSE_VERSION_ACTIVATED")
    .with("PurposeCloned", () => "PURPOSE_CLONED")
    .with(
      "PurposeVersionArchivedByRevokedDelegation",
      () => "PURPOSE_VERSION_ARCHIVED_BY_REVOKED_DELEGATION"
    )
    .with(
      "RiskAnalysisSignedDocumentGenerated",
      () => "RISK_ANALYSIS_SIGNED_DOCUMENT_GENERATED"
    )
    .exhaustive();
}

function toApiPurposeM2MEvent(
  event: PurposeM2MEvent
): m2mEventApi.PurposeM2MEvent {
  return {
    id: event.id,
    eventType: toApiPurposeM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    purposeId: event.purposeId,
    consumerDelegationId: event.consumerDelegationId,
    producerDelegationId: event.producerDelegationId,
  };
}

export function toApiPurposeM2MEvents(
  events: PurposeM2MEvent[]
): m2mEventApi.PurposeM2MEvents {
  return {
    events: events.map(toApiPurposeM2MEvent),
  };
}
