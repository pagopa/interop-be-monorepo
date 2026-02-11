import { m2mEventApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateM2MEvent,
  EServiceTemplateM2MEventType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiEServiceTemplateM2MEventType(
  eventType: EServiceTemplateM2MEventType
): m2mEventApi.EServiceTemplateM2MEvent["eventType"] {
  return match<
    EServiceTemplateM2MEventType,
    m2mEventApi.EServiceTemplateM2MEvent["eventType"]
  >(eventType)
    .with("EServiceTemplateDeleted", () => "ESERVICE_TEMPLATE_DELETED")
    .with(
      "EServiceTemplateVersionActivated",
      () => "ESERVICE_TEMPLATE_VERSION_ACTIVATED"
    )
    .with("EServiceTemplateAdded", () => "ESERVICE_TEMPLATE_ADDED")
    .with(
      "EServiceTemplateIntendedTargetUpdated",
      () => "ESERVICE_TEMPLATE_INTENDED_TARGET_UPDATED"
    )
    .with(
      "EServiceTemplateDescriptionUpdated",
      () => "ESERVICE_TEMPLATE_DESCRIPTION_UPDATED"
    )
    .with(
      "EServiceTemplateDraftVersionDeleted",
      () => "ESERVICE_TEMPLATE_DRAFT_VERSION_DELETED"
    )
    .with(
      "EServiceTemplateDraftVersionUpdated",
      () => "ESERVICE_TEMPLATE_DRAFT_VERSION_UPDATED"
    )
    .with(
      "EServiceTemplateDraftUpdated",
      () => "ESERVICE_TEMPLATE_DRAFT_UPDATED"
    )
    .with("EServiceTemplateNameUpdated", () => "ESERVICE_TEMPLATE_NAME_UPDATED")
    .with(
      "EServiceTemplateRiskAnalysisAdded",
      () => "ESERVICE_TEMPLATE_RISK_ANALYSIS_ADDED"
    )
    .with(
      "EServiceTemplateRiskAnalysisDeleted",
      () => "ESERVICE_TEMPLATE_RISK_ANALYSIS_DELETED"
    )
    .with(
      "EServiceTemplateRiskAnalysisUpdated",
      () => "ESERVICE_TEMPLATE_RISK_ANALYSIS_UPDATED"
    )
    .with(
      "EServiceTemplateVersionSuspended",
      () => "ESERVICE_TEMPLATE_VERSION_SUSPENDED"
    )
    .with(
      "EServiceTemplateVersionAdded",
      () => "ESERVICE_TEMPLATE_VERSION_ADDED"
    )
    .with(
      "EServiceTemplateVersionAttributesUpdated",
      () => "ESERVICE_TEMPLATE_VERSION_ATTRIBUTES_UPDATED"
    )
    .with(
      "EServiceTemplateVersionDocumentAdded",
      () => "ESERVICE_TEMPLATE_VERSION_DOCUMENT_ADDED"
    )
    .with(
      "EServiceTemplateVersionDocumentDeleted",
      () => "ESERVICE_TEMPLATE_VERSION_DOCUMENT_DELETED"
    )
    .with(
      "EServiceTemplateVersionDocumentUpdated",
      () => "ESERVICE_TEMPLATE_VERSION_DOCUMENT_UPDATED"
    )
    .with(
      "EServiceTemplateVersionInterfaceAdded",
      () => "ESERVICE_TEMPLATE_VERSION_INTERFACE_ADDED"
    )
    .with(
      "EServiceTemplateVersionInterfaceDeleted",
      () => "ESERVICE_TEMPLATE_VERSION_INTERFACE_DELETED"
    )
    .with(
      "EServiceTemplateVersionInterfaceUpdated",
      () => "ESERVICE_TEMPLATE_VERSION_INTERFACE_UPDATED"
    )
    .with(
      "EServiceTemplateVersionPublished",
      () => "ESERVICE_TEMPLATE_VERSION_PUBLISHED"
    )
    .with(
      "EServiceTemplateVersionQuotasUpdated",
      () => "ESERVICE_TEMPLATE_VERSION_QUOTAS_UPDATED"
    )
    .with(
      "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
      () => "ESERVICE_TEMPLATE_PERSONAL_DATA_FLAG_UPDATED_AFTER_PUBLICATION"
    )
    .exhaustive();
}

function toApiEServiceTemplateM2MEvent(
  event: EServiceTemplateM2MEvent
): m2mEventApi.EServiceTemplateM2MEvent {
  return {
    id: event.id,
    eventType: toApiEServiceTemplateM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    eserviceTemplateId: event.eserviceTemplateId,
    eserviceTemplateVersionId: event.eserviceTemplateVersionId,
  };
}

export function toApiEServiceTemplateM2MEvents(
  events: EServiceTemplateM2MEvent[]
): m2mEventApi.EServiceTemplateM2MEvents {
  return {
    events: events.map(toApiEServiceTemplateM2MEvent),
  };
}
