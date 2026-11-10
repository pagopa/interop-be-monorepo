import { CreateEvent, isFeatureFlagEnabled } from "pagopa-interop-commons";
import {
  Tenant,
  TenantEvent,
  AttributeId,
  ContactId,
  toTenantV2,
  toTenantV3,
  TenantKind,
  toTenantKindV2,
  toTenantKindV3,
  CorrelationId,
} from "pagopa-interop-models";

import { config } from "../../config/config.js";

/**
 * When the flag is enabled every tenant event is written as V3, where the
 * tenant references its contact by contactId and carries no mails.
 * The mail events are V2 only: the mail operations are not allowed in V3 mode.
 */
const isTenantEventsV3Enabled = (): boolean =>
  isFeatureFlagEnabled(config, "featureFlagTenantEventsV3");

export const toCreateEventTenantOnboarded = (
  tenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version: undefined,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantOnboarded",
        data: { tenant: toTenantV3(tenant) },
      }
    : {
        event_version: 2,
        type: "TenantOnboarded",
        data: { tenant: toTenantV2(tenant) },
      },
  correlationId,
});

export const toCreateEventTenantOnboardDetailsUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantOnboardDetailsUpdated",
        data: { tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantOnboardDetailsUpdated",
        data: { tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeExtensionUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantVerifiedAttributeExtensionUpdated",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantVerifiedAttributeExtensionUpdated",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeExpirationUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantVerifiedAttributeExpirationUpdated",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantVerifiedAttributeExpirationUpdated",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantCertifiedAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantCertifiedAttributeAssigned",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantCertifiedAttributeAssigned",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantKindUpdated = (
  version: number,
  oldKind: TenantKind | undefined,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantKindUpdated",
        data: {
          oldKind: oldKind ? toTenantKindV3(oldKind) : undefined,
          tenant: toTenantV3(updatedTenant),
        },
      }
    : {
        event_version: 2,
        type: "TenantKindUpdated",
        data: {
          oldKind: oldKind ? toTenantKindV2(oldKind) : undefined,
          tenant: toTenantV2(updatedTenant),
        },
      },
  correlationId,
});

export const toCreateEventTenantCertifiedAttributeRevoked = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantCertifiedAttributeRevoked",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantCertifiedAttributeRevoked",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantDeclaredAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantDeclaredAttributeAssigned",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantDeclaredAttributeAssigned",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventMaintenanceTenantDeleted = (
  version: number,
  tenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "MaintenanceTenantDeleted",
        data: { tenantId: tenant.id, tenant: toTenantV3(tenant) },
      }
    : {
        event_version: 2,
        type: "MaintenanceTenantDeleted",
        data: { tenantId: tenant.id, tenant: toTenantV2(tenant) },
      },
  correlationId,
});

export const toCreateEventMaintenanceTenantUpdated = (
  version: number,
  tenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "MaintenanceTenantUpdated",
        data: { tenant: toTenantV3(tenant) },
      }
    : {
        event_version: 2,
        type: "MaintenanceTenantUpdated",
        data: { tenant: toTenantV2(tenant) },
      },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantVerifiedAttributeAssigned",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantVerifiedAttributeAssigned",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeRevoked = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantVerifiedAttributeRevoked",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantVerifiedAttributeRevoked",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantDeclaredAttributeRevoked = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantDeclaredAttributeRevoked",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantDeclaredAttributeRevoked",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantMailDeleted = (
  version: number,
  updatedTenant: Tenant,
  mailId: string,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    event_version: 2,
    type: "TenantMailDeleted",
    data: {
      mailId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantMailAdded = (
  version: number,
  updatedTenant: Tenant,
  mailId: string,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    event_version: 2,
    type: "TenantMailAdded",
    data: {
      mailId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantContactAdded = (
  version: number,
  updatedTenant: Tenant,
  contactId: ContactId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    event_version: 3,
    type: "TenantContactAdded",
    data: {
      contactId,
      tenant: toTenantV3(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantContactDeleted = (
  version: number,
  updatedTenant: Tenant,
  contactId: ContactId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    event_version: 3,
    type: "TenantContactDeleted",
    data: {
      contactId,
      tenant: toTenantV3(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventMaintenanceTenantPromotedToCertifier = (
  version: number,
  tenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "MaintenanceTenantPromotedToCertifier",
        data: { tenant: toTenantV3(tenant) },
      }
    : {
        event_version: 2,
        type: "MaintenanceTenantPromotedToCertifier",
        data: { tenant: toTenantV2(tenant) },
      },
  correlationId,
});

export const toCreateEventTenantDelegatedProducerFeatureAdded = (
  version: number,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantDelegatedProducerFeatureAdded",
        data: { tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantDelegatedProducerFeatureAdded",
        data: { tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantDelegatedProducerFeatureRemoved = (
  version: number,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantDelegatedProducerFeatureRemoved",
        data: { tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantDelegatedProducerFeatureRemoved",
        data: { tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantDelegatedConsumerFeatureAdded = (
  version: number,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantDelegatedConsumerFeatureAdded",
        data: { tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantDelegatedConsumerFeatureAdded",
        data: { tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantDelegatedConsumerFeatureRemoved = (
  version: number,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantDelegatedConsumerFeatureRemoved",
        data: { tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantDelegatedConsumerFeatureRemoved",
        data: { tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantRemoteIdAssigned = (
  version: number,
  updatedTenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantRemoteIdAssigned",
        data: { tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantRemoteIdAssigned",
        data: { tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantCertifiedDiscreteAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantCertifiedDiscreteAttributeAssigned",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantCertifiedDiscreteAttributeAssigned",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantCertifiedDiscreteAttributeRevoked = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantCertifiedDiscreteAttributeRevoked",
        data: { attributeId, tenant: toTenantV3(updatedTenant) },
      }
    : {
        event_version: 2,
        type: "TenantCertifiedDiscreteAttributeRevoked",
        data: { attributeId, tenant: toTenantV2(updatedTenant) },
      },
  correlationId,
});

export const toCreateEventTenantCertifiedDiscreteAttributeUpdated = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  previousValue: number,
  newValue: number,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: isTenantEventsV3Enabled()
    ? {
        event_version: 3,
        type: "TenantCertifiedDiscreteAttributeUpdated",
        data: {
          attributeId,
          tenant: toTenantV3(updatedTenant),
          previousValue,
          newValue,
        },
      }
    : {
        event_version: 2,
        type: "TenantCertifiedDiscreteAttributeUpdated",
        data: {
          attributeId,
          tenant: toTenantV2(updatedTenant),
          previousValue,
          newValue,
        },
      },
  correlationId,
});

export function toCreateEventMaintenanceTenantRemoteIdDeleted(
  version: number,
  tenant: Tenant,
  correlationId: CorrelationId
): CreateEvent<TenantEvent> {
  return {
    streamId: tenant.id,
    version,
    event: isTenantEventsV3Enabled()
      ? {
          event_version: 3,
          type: "MaintenanceTenantRemoteIdDeleted",
          data: { tenant: toTenantV3(tenant) },
        }
      : {
          event_version: 2,
          type: "MaintenanceTenantRemoteIdDeleted",
          data: { tenant: toTenantV2(tenant) },
        },
    correlationId,
  };
}
