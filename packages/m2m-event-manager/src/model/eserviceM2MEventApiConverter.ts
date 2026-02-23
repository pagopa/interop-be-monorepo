import { m2mEventApi } from "pagopa-interop-api-clients";
import { EServiceM2MEvent, EServiceM2MEventType } from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiEServiceM2MEventType(
  eventType: EServiceM2MEventType
): m2mEventApi.EServiceM2MEvent["eventType"] {
  return match<EServiceM2MEventType, m2mEventApi.EServiceM2MEvent["eventType"]>(
    eventType
  )
    .with("EServiceAdded", () => "ESERVICE_ADDED")
    .with("DraftEServiceUpdated", () => "DRAFT_ESERVICE_UPDATED")
    .with("EServiceCloned", () => "ESERVICE_CLONED")
    .with("EServiceDeleted", () => "ESERVICE_DELETED")
    .with("EServiceNameUpdated", () => "ESERVICE_NAME_UPDATED")
    .with("EServiceDescriptionUpdated", () => "ESERVICE_DESCRIPTION_UPDATED")
    .with(
      "EServiceIsConsumerDelegableEnabled",
      () => "ESERVICE_IS_CONSUMER_DELEGABLE_ENABLED"
    )
    .with(
      "EServiceIsConsumerDelegableDisabled",
      () => "ESERVICE_IS_CONSUMER_DELEGABLE_DISABLED"
    )
    .with(
      "EServiceIsClientAccessDelegableEnabled",
      () => "ESERVICE_IS_CLIENT_ACCESS_DELEGABLE_ENABLED"
    )
    .with(
      "EServiceIsClientAccessDelegableDisabled",
      () => "ESERVICE_IS_CLIENT_ACCESS_DELEGABLE_DISABLED"
    )
    .with(
      "EServiceNameUpdatedByTemplateUpdate",
      () => "ESERVICE_NAME_UPDATED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceDescriptionUpdatedByTemplateUpdate",
      () => "ESERVICE_DESCRIPTION_UPDATED_BY_TEMPLATE_UPDATE"
    )
    .with("EServiceSignalHubEnabled", () => "ESERVICE_SIGNAL_HUB_ENABLED")
    .with("EServiceSignalHubDisabled", () => "ESERVICE_SIGNAL_HUB_DISABLED")
    .with("EServiceRiskAnalysisAdded", () => "ESERVICE_RISK_ANALYSIS_ADDED")
    .with("EServiceRiskAnalysisUpdated", () => "ESERVICE_RISK_ANALYSIS_UPDATED")
    .with("EServiceRiskAnalysisDeleted", () => "ESERVICE_RISK_ANALYSIS_DELETED")
    .with("EServiceDescriptorPublished", () => "ESERVICE_DESCRIPTOR_PUBLISHED")
    .with("EServiceDescriptorActivated", () => "ESERVICE_DESCRIPTOR_ACTIVATED")
    .with(
      "EServiceDescriptorApprovedByDelegator",
      () => "ESERVICE_DESCRIPTOR_APPROVED_BY_DELEGATOR"
    )
    .with("EServiceDescriptorSuspended", () => "ESERVICE_DESCRIPTOR_SUSPENDED")
    .with("EServiceDescriptorArchived", () => "ESERVICE_DESCRIPTOR_ARCHIVED")
    .with(
      "EServiceDescriptorQuotasUpdated",
      () => "ESERVICE_DESCRIPTOR_QUOTAS_UPDATED"
    )
    .with(
      "EServiceDescriptorAgreementApprovalPolicyUpdated",
      () => "ESERVICE_DESCRIPTOR_AGREEMENT_APPROVAL_POLICY_UPDATED"
    )
    .with("EServiceDescriptorAdded", () => "ESERVICE_DESCRIPTOR_ADDED")
    .with(
      "EServiceDraftDescriptorDeleted",
      () => "ESERVICE_DRAFT_DESCRIPTOR_DELETED"
    )
    .with(
      "EServiceDraftDescriptorUpdated",
      () => "ESERVICE_DRAFT_DESCRIPTOR_UPDATED"
    )
    .with(
      "EServiceDescriptorAttributesUpdated",
      () => "ESERVICE_DESCRIPTOR_ATTRIBUTES_UPDATED"
    )
    .with(
      "EServiceDescriptorSubmittedByDelegate",
      () => "ESERVICE_DESCRIPTOR_SUBMITTED_BY_DELEGATE"
    )
    .with(
      "EServiceDescriptorRejectedByDelegator",
      () => "ESERVICE_DESCRIPTOR_REJECTED_BY_DELEGATOR"
    )
    .with(
      "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
      () => "ESERVICE_DESCRIPTOR_ATTRIBUTES_UPDATED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
      () => "ESERVICE_DESCRIPTOR_QUOTAS_UPDATED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceDescriptorDocumentAdded",
      () => "ESERVICE_DESCRIPTOR_DOCUMENT_ADDED"
    )
    .with(
      "EServiceDescriptorDocumentUpdated",
      () => "ESERVICE_DESCRIPTOR_DOCUMENT_UPDATED"
    )
    .with(
      "EServiceDescriptorDocumentDeleted",
      () => "ESERVICE_DESCRIPTOR_DOCUMENT_DELETED"
    )
    .with(
      "EServiceDescriptorDocumentAddedByTemplateUpdate",
      () => "ESERVICE_DESCRIPTOR_DOCUMENT_ADDED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceDescriptorDocumentDeletedByTemplateUpdate",
      () => "ESERVICE_DESCRIPTOR_DOCUMENT_DELETED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
      () => "ESERVICE_DESCRIPTOR_DOCUMENT_UPDATED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceDescriptorInterfaceAdded",
      () => "ESERVICE_DESCRIPTOR_INTERFACE_ADDED"
    )
    .with(
      "EServiceDescriptorInterfaceUpdated",
      () => "ESERVICE_DESCRIPTOR_INTERFACE_UPDATED"
    )
    .with(
      "EServiceDescriptorInterfaceDeleted",
      () => "ESERVICE_DESCRIPTOR_INTERFACE_DELETED"
    )
    .with(
      "EServicePersonalDataFlagUpdatedAfterPublication",
      () => "ESERVICE_PERSONAL_DATA_FLAG_UPDATED_AFTER_PUBLICATION"
    )
    .with(
      "EServicePersonalDataFlagUpdatedByTemplateUpdate",
      () => "ESERVICE_PERSONAL_DATA_FLAG_UPDATED_BY_TEMPLATE_UPDATE"
    )
    .with(
      "EServiceInstanceLabelUpdated",
      () => "ESERVICE_INSTANCE_LABEL_UPDATED"
    )
    .exhaustive();
}

function toApiEServiceM2MEvent(
  event: EServiceM2MEvent
): m2mEventApi.EServiceM2MEvent {
  return {
    id: event.id,
    eventType: toApiEServiceM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    eserviceId: event.eserviceId,
    descriptorId: event.descriptorId,
    producerDelegationId: event.producerDelegationId,
  };
}

export function toApiEServiceM2MEvents(
  events: EServiceM2MEvent[]
): m2mEventApi.EServiceM2MEvents {
  return {
    events: events.map(toApiEServiceM2MEvent),
  };
}
