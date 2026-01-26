import { m2mEventApi } from "pagopa-interop-api-clients";
import {
  PurposeTemplateM2MEvent,
  PurposeTemplateM2MEventType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiPurposeTemplateM2MEventType(
  eventType: PurposeTemplateM2MEventType
): m2mEventApi.PurposeTemplateM2MEvent["eventType"] {
  return match<
    PurposeTemplateM2MEventType,
    m2mEventApi.PurposeTemplateM2MEvent["eventType"]
  >(eventType)
    .with("PurposeTemplateAdded", () => "PURPOSE_TEMPLATE_ADDED")
    .with(
      "PurposeTemplateAnnotationDocumentAdded",
      () => "PURPOSE_TEMPLATE_ANNOTATION_DOCUMENT_ADDED"
    )
    .with(
      "PurposeTemplateAnnotationDocumentDeleted",
      () => "PURPOSE_TEMPLATE_ANNOTATION_DOCUMENT_DELETED"
    )
    .with(
      "PurposeTemplateAnnotationDocumentUpdated",
      () => "PURPOSE_TEMPLATE_ANNOTATION_DOCUMENT_UPDATED"
    )
    .with("PurposeTemplateDraftUpdated", () => "PURPOSE_TEMPLATE_DRAFT_UPDATED")
    .with("PurposeTemplateDraftDeleted", () => "PURPOSE_TEMPLATE_DRAFT_DELETED")
    .with("PurposeTemplatePublished", () => "PURPOSE_TEMPLATE_PUBLISHED")
    .with("PurposeTemplateSuspended", () => "PURPOSE_TEMPLATE_SUSPENDED")
    .with("PurposeTemplateUnsuspended", () => "PURPOSE_TEMPLATE_UNSUSPENDED")
    .with("PurposeTemplateArchived", () => "PURPOSE_TEMPLATE_ARCHIVED")
    .with(
      "RiskAnalysisTemplateSignedDocumentGenerated",
      () => "RISK_ANALYSIS_TEMPLATE_SIGNED_DOCUMENT_GENERATED"
    )
    .with(
      "PurposeTemplateEServiceLinked",
      () => "PURPOSE_TEMPLATE_ESERVICE_LINKED"
    )
    .with(
      "PurposeTemplateEServiceUnlinked",
      () => "PURPOSE_TEMPLATE_ESERVICE_UNLINKED"
    )
    .exhaustive();
}

function toApiPurposeTemplateM2MEvent(
  event: PurposeTemplateM2MEvent
): m2mEventApi.PurposeTemplateM2MEvent {
  return {
    id: event.id,
    eventType: toApiPurposeTemplateM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    purposeTemplateId: event.purposeTemplateId,
  };
}

export function toApiPurposeTemplateM2MEvents(
  events: PurposeTemplateM2MEvent[]
): m2mEventApi.PurposeTemplateM2MEvents {
  return {
    events: events.map(toApiPurposeTemplateM2MEvent),
  };
}
