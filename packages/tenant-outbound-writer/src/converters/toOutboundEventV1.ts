import {
  TenantAttributeV1,
  TenantEventEnvelopeV1,
  TenantFeatureV1,
  TenantV1,
} from "pagopa-interop-models";
import {
  TenantEvent as OutboundTenantEvent,
  TenantV1 as OutboundTenantV1,
  TenantFeatureV1 as OutboundTenantFeatureV1,
  TenantAttributeV1 as OutboundTenantAttributeV1,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOutboundTenantFeaturesV1(
  feature: TenantFeatureV1
): Exact<OutboundTenantFeatureV1, TenantFeatureV1> {
  return feature as Exact<OutboundTenantFeatureV1, TenantFeatureV1>;
}

function toOutboundTenantAttributeV1(
  attribute: TenantAttributeV1
): Exact<OutboundTenantAttributeV1, TenantAttributeV1> {
  return attribute as Exact<OutboundTenantAttributeV1, TenantAttributeV1>;
}
function toOutboundTenantV1(
  tenant: TenantV1
): Exact<OutboundTenantV1, TenantV1> {
  return {
    ...tenant,
    mails: undefined,
    features: tenant.features.map(toOutboundTenantFeaturesV1),
    attributes: tenant.attributes.map(toOutboundTenantAttributeV1),
  };
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
        tenant:
          msg.data.tenant &&
          (toOutboundTenantV1(msg.data.tenant) as OutboundTenantV1),
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
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
      streamVersion: msg.version,
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
