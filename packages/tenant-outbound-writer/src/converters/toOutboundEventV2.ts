import { TenantEventEnvelopeV2, TenantV2 } from "pagopa-interop-models";
import {
  TenantEvent as OutboundTenantEvent,
  TenantV2 as OutboundTenantV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "../utils.js";

function toOutboundTenantV2(tenant: TenantV2): OutboundTenantV2 {
  const outboundTenant: Exact<OutboundTenantV2, TenantV2> = {
    ...tenant,
    mails: undefined,
  };
  return outboundTenant as OutboundTenantV2;
}

export function toOutboundEventV2(
  message: TenantEventEnvelopeV2
): OutboundTenantEvent | undefined {
  return match(message)
    .returnType<OutboundTenantEvent | undefined>()
    .with(
      { type: "TenantOnboarded" },
      { type: "TenantOnboardDetailsUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "TenantCertifiedAttributeAssigned" },
      { type: "TenantCertifiedAttributeRevoked" },
      { type: "TenantDeclaredAttributeAssigned" },
      { type: "TenantDeclaredAttributeRevoked" },
      { type: "TenantVerifiedAttributeAssigned" },
      { type: "TenantVerifiedAttributeRevoked" },
      { type: "TenantVerifiedAttributeExpirationUpdated" },
      { type: "TenantVerifiedAttributeExtensionUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          attributeId: msg.data.attributeId,
          tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "MaintenanceTenantDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        tenantId: msg.data.tenantId,
        tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "TenantKindUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        oldKind: msg.data.oldKind,
        tenant: msg.data.tenant && toOutboundTenantV2(msg.data.tenant),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "TenantMailAdded" }, () => undefined)
    .exhaustive();
}
