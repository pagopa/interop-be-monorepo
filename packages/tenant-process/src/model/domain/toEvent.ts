import { CreateEvent } from "pagopa-interop-commons";
import {
  Tenant,
  TenantEvent,
  AttributeId,
  toTenantV2,
  TenantKind,
  toTenantKindV2,
} from "pagopa-interop-models";
export const toCreateEventTenantOnboarded = (
  tenant: Tenant,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version: 0,
  event: {
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
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    event_version: 2,
    type: "TenantOnboardDetailsUpdated",
    data: {
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeExtensionUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    event_version: 2,
    type: "TenantVerifiedAttributeExtensionUpdated",
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeExpirationUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    event_version: 2,
    type: "TenantVerifiedAttributeExpirationUpdated",
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantCertifiedAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantCertifiedAttributeAssigned",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantKindUpdated = (
  version: number,
  oldKind: TenantKind,
  updatedTenant: Tenant,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantKindUpdated",
    event_version: 2,
    data: {
      oldKind: toTenantKindV2(oldKind),
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantDeclaredAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantDeclaredAttributeAssigned",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantCertifiedAttributeRevoked = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantCertifiedAttributeRevoked",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventMaintenanceTenantDeleted = (
  version: number,
  tenant: Tenant,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version,
  event: {
    event_version: 2,
    type: "MaintenanceTenantDeleted",
    data: {
      tenantId: tenant.id,
      tenant: toTenantV2(tenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantVerifiedAttributeAssigned = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantVerifiedAttributeAssigned",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantDeclaredAttributeRevoked = (
  version: number,
  updatedTenant: Tenant,
  attributeId: AttributeId,
  correlationId: string
): CreateEvent<TenantEvent> => ({
  streamId: updatedTenant.id,
  version,
  event: {
    type: "TenantDeclaredAttributeRevoked",
    event_version: 2,
    data: {
      attributeId,
      tenant: toTenantV2(updatedTenant),
    },
  },
  correlationId,
});

export const toCreateEventTenantMailDeleted = (
  version: number,
  updatedTenant: Tenant,
  mailId: string,
  correlationId: string
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
  correlationId: string
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
