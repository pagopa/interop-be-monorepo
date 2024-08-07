import { TenantEventEnvelopeV1, TenantV1 } from "pagopa-interop-models";
import {
  TenantEvent as OutboundTenantEvent,
  TenantV1 as OutboundTenantV1,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "../utils.js";

function toOutboundTenantV1(tenant: TenantV1): OutboundTenantV1 {
  const outboundTenant: Exact<OutboundTenantV1, TenantV1> = {
    ...tenant,
    mails: undefined,
  };
  return outboundTenant as OutboundTenantV1;
}

export function toOutboundEventV1(
  message: TenantEventEnvelopeV1
): OutboundTenantEvent | undefined {
  return match(message)
    .returnType<OutboundTenantEvent | undefined>()
    .with({ type: "TenantCreated" }, { type: "TenantUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        tenant: msg.data.tenant && toOutboundTenantV1(msg.data.tenant),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "TenantDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        tenantId: msg.data.tenantId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with(
      { type: "SelfcareMappingCreated" },
      { type: "SelfcareMappingDeleted" },
      { type: "TenantMailAdded" },
      { type: "TenantMailDeleted" },
      () => undefined
    )
    .exhaustive();
}
