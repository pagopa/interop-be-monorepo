import { m2mEventApi } from "pagopa-interop-api-clients";
import { TenantM2MEvent, TenantM2MEventType } from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiTenantM2MEventType(
  eventType: TenantM2MEventType
): m2mEventApi.TenantM2MEvent["eventType"] {
  return match<TenantM2MEventType, m2mEventApi.TenantM2MEvent["eventType"]>(
    eventType
  )
    .with("MaintenanceTenantDeleted", () => "MAINTENANCE_TENANT_DELETED")
    .with(
      "MaintenanceTenantPromotedToCertifier",
      () => "MAINTENANCE_TENANT_PROMOTED_TO_CERTIFIER"
    )
    .with("MaintenanceTenantUpdated", () => "MAINTENANCE_TENANT_UPDATED")
    .with(
      "TenantCertifiedAttributeAssigned",
      () => "TENANT_CERTIFIED_ATTRIBUTE_ASSIGNED"
    )
    .with(
      "TenantCertifiedAttributeRevoked",
      () => "TENANT_CERTIFIED_ATTRIBUTE_REVOKED"
    )
    .with(
      "TenantDeclaredAttributeAssigned",
      () => "TENANT_DECLARED_ATTRIBUTE_ASSIGNED"
    )
    .with(
      "TenantDeclaredAttributeRevoked",
      () => "TENANT_DECLARED_ATTRIBUTE_REVOKED"
    )
    .with(
      "TenantDelegatedConsumerFeatureAdded",
      () => "TENANT_DELEGATED_CONSUMER_FEATURE_ADDED"
    )
    .with(
      "TenantDelegatedConsumerFeatureRemoved",
      () => "TENANT_DELEGATED_CONSUMER_FEATURE_REMOVED"
    )
    .with(
      "TenantDelegatedProducerFeatureAdded",
      () => "TENANT_DELEGATED_PRODUCER_FEATURE_ADDED"
    )
    .with(
      "TenantDelegatedProducerFeatureRemoved",
      () => "TENANT_DELEGATED_PRODUCER_FEATURE_REMOVED"
    )
    .with("TenantKindUpdated", () => "TENANT_KIND_UPDATED")
    .with("TenantMailAdded", () => "TENANT_MAIL_ADDED")
    .with("TenantMailDeleted", () => "TENANT_MAIL_DELETED")
    .with("TenantOnboardDetailsUpdated", () => "TENANT_ONBOARD_DETAILS_UPDATED")
    .with("TenantOnboarded", () => "TENANT_ONBOARDED")
    .with(
      "TenantVerifiedAttributeAssigned",
      () => "TENANT_VERIFIED_ATTRIBUTE_ASSIGNED"
    )
    .with(
      "TenantVerifiedAttributeExpirationUpdated",
      () => "TENANT_VERIFIED_ATTRIBUTE_EXPIRATION_UPDATED"
    )
    .with(
      "TenantVerifiedAttributeExtensionUpdated",
      () => "TENANT_VERIFIED_ATTRIBUTE_EXTENSION_UPDATED"
    )
    .with(
      "TenantVerifiedAttributeRevoked",
      () => "TENANT_VERIFIED_ATTRIBUTE_REVOKED"
    )
    .exhaustive();
}

function toApiTenantM2MEvent(
  event: TenantM2MEvent
): m2mEventApi.TenantM2MEvent {
  return {
    id: event.id,
    eventType: toApiTenantM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    tenantId: event.tenantId,
  };
}

export function toApiTenantM2MEvents(
  events: TenantM2MEvent[]
): m2mEventApi.TenantM2MEvents {
  return {
    events: events.map(toApiTenantM2MEvent),
  };
}
