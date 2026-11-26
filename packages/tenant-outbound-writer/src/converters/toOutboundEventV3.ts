import {
  TenantEvent as OutboundTenantEvent,
  TenantV2 as OutboundTenantV2,
} from "@pagopa/interop-outbound-models";
import {
  TenantEventEnvelopeV3,
  TenantV3,
  fromTenantKindV3,
  fromTenantUnitTypeV3,
  toTenantKindV2,
  toTenantUnitTypeV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

// The outbound contract stays V2: the contact reference is not published,
// as the plain-text mails never were. Kind and unit type go through the
// domain because the V3 and V2 enums are distinct TypeScript types.
function toOutboundTenantV2(tenant: TenantV3): OutboundTenantV2 {
  return {
    id: tenant.id,
    selfcareId: tenant.selfcareId,
    externalId: tenant.externalId,
    features: tenant.features,
    attributes: tenant.attributes,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    name: tenant.name,
    kind:
      tenant.kind !== undefined
        ? toTenantKindV2(fromTenantKindV3(tenant.kind))
        : undefined,
    onboardedAt: tenant.onboardedAt,
    subUnitType:
      tenant.subUnitType !== undefined
        ? toTenantUnitTypeV2(fromTenantUnitTypeV3(tenant.subUnitType))
        : undefined,
    selfcareInstitutionType: tenant.selfcareInstitutionType,
    remoteIds: tenant.remoteIds,
  };
}

export function toOutboundEventV3(
  message: TenantEventEnvelopeV3
): OutboundTenantEvent | undefined {
  return match(message)
    .returnType<OutboundTenantEvent | undefined>()
    .with(
      { type: "TenantOnboarded" },
      { type: "TenantOnboardDetailsUpdated" },
      { type: "MaintenanceTenantPromotedToCertifier" },
      { type: "MaintenanceTenantUpdated" },
      { type: "TenantDelegatedProducerFeatureAdded" },
      { type: "TenantDelegatedProducerFeatureRemoved" },
      { type: "TenantDelegatedConsumerFeatureAdded" },
      { type: "TenantDelegatedConsumerFeatureRemoved" },
      { type: "TenantRemoteIdAssigned" },
      { type: "MaintenanceTenantRemoteIdDeleted" },
      (msg) => ({
        event_version: 2,
        type: msg.type,
        version: msg.version,
        data: {
          tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
        },
        stream_id: msg.stream_id,
        streamVersion: msg.version,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "TenantCertifiedAttributeAssigned" },
      { type: "TenantCertifiedAttributeRevoked" },
      { type: "TenantCertifiedDiscreteAttributeAssigned" },
      { type: "TenantCertifiedDiscreteAttributeRevoked" },
      { type: "TenantCertifiedDiscreteAttributeUpdated" },
      { type: "TenantDeclaredAttributeAssigned" },
      { type: "TenantDeclaredAttributeRevoked" },
      { type: "TenantVerifiedAttributeAssigned" },
      { type: "TenantVerifiedAttributeRevoked" },
      { type: "TenantVerifiedAttributeExpirationUpdated" },
      { type: "TenantVerifiedAttributeExtensionUpdated" },
      (msg) => ({
        event_version: 2,
        type: msg.type,
        version: msg.version,
        data: {
          attributeId: msg.data.attributeId,
          tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
        },
        stream_id: msg.stream_id,
        streamVersion: msg.version,
        timestamp: new Date(),
      })
    )
    .with({ type: "MaintenanceTenantDeleted" }, (msg) => ({
      event_version: 2,
      type: msg.type,
      version: msg.version,
      data: {
        tenantId: msg.data.tenantId,
        tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .with({ type: "TenantKindUpdated" }, (msg) => ({
      event_version: 2,
      type: msg.type,
      version: msg.version,
      data: {
        oldKind:
          msg.data.oldKind !== undefined
            ? toTenantKindV2(fromTenantKindV3(msg.data.oldKind))
            : undefined,
        tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .with(
      { type: "TenantContactAdded" },
      { type: "TenantContactDeleted" },
      () => undefined
    )
    .exhaustive();
}
