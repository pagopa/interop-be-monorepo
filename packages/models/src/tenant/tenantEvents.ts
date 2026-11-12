import { match } from "ts-pattern";
import { z } from "zod";

import { ContactId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import { EventEnvelope } from "../events/events.js";
import {
  TenantCreatedV1,
  TenantUpdatedV1,
  TenantDeletedV1,
  SelfcareMappingCreatedV1,
  SelfcareMappingDeletedV1,
  TenantMailAddedV1,
  TenantMailDeletedV1,
} from "../gen/v1/tenant/events.js";
import {
  TenantOnboardedV2,
  TenantOnboardDetailsUpdatedV2,
  TenantCertifiedAttributeAssignedV2,
  TenantCertifiedAttributeRevokedV2,
  TenantCertifiedDiscreteAttributeAssignedV2,
  TenantCertifiedDiscreteAttributeRevokedV2,
  TenantCertifiedDiscreteAttributeUpdatedV2,
  TenantDeclaredAttributeAssignedV2,
  TenantDeclaredAttributeRevokedV2,
  TenantVerifiedAttributeAssignedV2,
  TenantVerifiedAttributeRevokedV2,
  TenantVerifiedAttributeExpirationUpdatedV2,
  MaintenanceTenantDeletedV2,
  TenantMailAddedV2,
  TenantVerifiedAttributeExtensionUpdatedV2,
  MaintenanceTenantPromotedToCertifierV2,
  TenantMailDeletedV2,
  TenantKindUpdatedV2,
  TenantDelegatedProducerFeatureAddedV2,
  TenantDelegatedProducerFeatureRemovedV2,
  MaintenanceTenantUpdatedV2,
  TenantDelegatedConsumerFeatureAddedV2,
  TenantDelegatedConsumerFeatureRemovedV2,
  TenantRemoteIdAssignedV2,
  MaintenanceTenantRemoteIdDeletedV2,
} from "../gen/v2/tenant/events.js";
import {
  TenantOnboardedV3,
  TenantOnboardDetailsUpdatedV3,
  TenantCertifiedAttributeAssignedV3,
  TenantCertifiedAttributeRevokedV3,
  TenantCertifiedDiscreteAttributeAssignedV3,
  TenantCertifiedDiscreteAttributeRevokedV3,
  TenantCertifiedDiscreteAttributeUpdatedV3,
  TenantDeclaredAttributeAssignedV3,
  TenantDeclaredAttributeRevokedV3,
  TenantVerifiedAttributeAssignedV3,
  TenantVerifiedAttributeRevokedV3,
  TenantVerifiedAttributeExpirationUpdatedV3,
  TenantVerifiedAttributeExtensionUpdatedV3,
  MaintenanceTenantDeletedV3,
  MaintenanceTenantUpdatedV3,
  TenantContactAddedV3,
  TenantKindUpdatedV3,
  TenantContactDeletedV3,
  MaintenanceTenantPromotedToCertifierV3,
  TenantDelegatedProducerFeatureAddedV3,
  TenantDelegatedProducerFeatureRemovedV3,
  TenantDelegatedConsumerFeatureAddedV3,
  TenantDelegatedConsumerFeatureRemovedV3,
  TenantRemoteIdAssignedV3,
  MaintenanceTenantRemoteIdDeletedV3,
} from "../gen/v3/tenant/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";

export function tenantEventToBinaryData(event: TenantEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, tenantEventToBinaryDataV1)
    .with({ event_version: 2 }, tenantEventToBinaryDataV2)
    .with({ event_version: 3 }, tenantEventToBinaryDataV3)
    .exhaustive();
}

export function tenantEventToBinaryDataV1(event: TenantEventV1): Uint8Array {
  return match(event)
    .with({ type: "TenantCreated" }, ({ data }) =>
      TenantCreatedV1.toBinary(data)
    )
    .with({ type: "TenantUpdated" }, ({ data }) =>
      TenantUpdatedV1.toBinary(data)
    )
    .with({ type: "TenantDeleted" }, ({ data }) =>
      TenantDeletedV1.toBinary(data)
    )
    .with({ type: "SelfcareMappingCreated" }, ({ data }) =>
      SelfcareMappingCreatedV1.toBinary(data)
    )
    .with({ type: "SelfcareMappingDeleted" }, ({ data }) =>
      SelfcareMappingDeletedV1.toBinary(data)
    )
    .with({ type: "TenantMailAdded" }, ({ data }) =>
      TenantMailAddedV1.toBinary(data)
    )
    .with({ type: "TenantMailDeleted" }, ({ data }) =>
      TenantMailDeletedV1.toBinary(data)
    )
    .exhaustive();
}

export function tenantEventToBinaryDataV2(event: TenantEventV2): Uint8Array {
  return match(event)
    .with({ type: "TenantOnboarded" }, ({ data }) =>
      TenantOnboardedV2.toBinary(data)
    )
    .with({ type: "TenantOnboardDetailsUpdated" }, ({ data }) =>
      TenantOnboardDetailsUpdatedV2.toBinary(data)
    )
    .with({ type: "TenantCertifiedAttributeAssigned" }, ({ data }) =>
      TenantCertifiedAttributeAssignedV2.toBinary(data)
    )
    .with({ type: "TenantCertifiedAttributeRevoked" }, ({ data }) =>
      TenantCertifiedAttributeRevokedV2.toBinary(data)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeAssigned" }, ({ data }) =>
      TenantCertifiedDiscreteAttributeAssignedV2.toBinary(data)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeRevoked" }, ({ data }) =>
      TenantCertifiedDiscreteAttributeRevokedV2.toBinary(data)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeUpdated" }, ({ data }) =>
      TenantCertifiedDiscreteAttributeUpdatedV2.toBinary(data)
    )
    .with({ type: "TenantDeclaredAttributeAssigned" }, ({ data }) =>
      TenantDeclaredAttributeAssignedV2.toBinary(data)
    )
    .with({ type: "TenantDeclaredAttributeRevoked" }, ({ data }) =>
      TenantDeclaredAttributeRevokedV2.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeAssigned" }, ({ data }) =>
      TenantVerifiedAttributeAssignedV2.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeRevoked" }, ({ data }) =>
      TenantVerifiedAttributeRevokedV2.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeExpirationUpdated" }, ({ data }) =>
      TenantVerifiedAttributeExpirationUpdatedV2.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeExtensionUpdated" }, ({ data }) =>
      TenantVerifiedAttributeExtensionUpdatedV2.toBinary(data)
    )
    .with({ type: "MaintenanceTenantDeleted" }, ({ data }) =>
      MaintenanceTenantDeletedV2.toBinary(data)
    )
    .with({ type: "MaintenanceTenantUpdated" }, ({ data }) =>
      MaintenanceTenantUpdatedV2.toBinary(data)
    )
    .with({ type: "TenantMailAdded" }, ({ data }) =>
      TenantMailAddedV2.toBinary(data)
    )
    .with({ type: "TenantKindUpdated" }, ({ data }) =>
      TenantKindUpdatedV2.toBinary(data)
    )
    .with({ type: "TenantMailDeleted" }, ({ data }) =>
      TenantMailDeletedV2.toBinary(data)
    )
    .with({ type: "MaintenanceTenantPromotedToCertifier" }, ({ data }) =>
      MaintenanceTenantPromotedToCertifierV2.toBinary(data)
    )
    .with({ type: "TenantDelegatedProducerFeatureAdded" }, ({ data }) =>
      TenantDelegatedProducerFeatureAddedV2.toBinary(data)
    )
    .with({ type: "TenantDelegatedProducerFeatureRemoved" }, ({ data }) =>
      TenantDelegatedProducerFeatureRemovedV2.toBinary(data)
    )
    .with({ type: "TenantDelegatedConsumerFeatureAdded" }, ({ data }) =>
      TenantDelegatedConsumerFeatureAddedV2.toBinary(data)
    )
    .with({ type: "TenantDelegatedConsumerFeatureRemoved" }, ({ data }) =>
      TenantDelegatedConsumerFeatureRemovedV2.toBinary(data)
    )
    .with({ type: "TenantRemoteIdAssigned" }, ({ data }) =>
      TenantRemoteIdAssignedV2.toBinary(data)
    )
    .with({ type: "MaintenanceTenantRemoteIdDeleted" }, ({ data }) =>
      MaintenanceTenantRemoteIdDeletedV2.toBinary(data)
    )
    .exhaustive();
}

/**
 * V3 events reference the tenant contact only through an opaque CDM
 * identifier: any other value (e.g. a plain-text email address) is rejected
 * before it reaches the event store. The rejected value is deliberately left
 * out of the error, so that it cannot leak into the logs.
 */
function assertOpaqueContactId(contactId: string | undefined): void {
  if (contactId !== undefined && !ContactId.safeParse(contactId).success) {
    throw genericError(
      "Tenant V3 event rejected: contactId is not an opaque contact identifier"
    );
  }
}

export function tenantEventToBinaryDataV3(event: TenantEventV3): Uint8Array {
  assertOpaqueContactId(event.data.tenant?.contactId);

  return match(event)
    .with({ type: "TenantOnboarded" }, ({ data }) =>
      TenantOnboardedV3.toBinary(data)
    )
    .with({ type: "TenantOnboardDetailsUpdated" }, ({ data }) =>
      TenantOnboardDetailsUpdatedV3.toBinary(data)
    )
    .with({ type: "TenantCertifiedAttributeAssigned" }, ({ data }) =>
      TenantCertifiedAttributeAssignedV3.toBinary(data)
    )
    .with({ type: "TenantCertifiedAttributeRevoked" }, ({ data }) =>
      TenantCertifiedAttributeRevokedV3.toBinary(data)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeAssigned" }, ({ data }) =>
      TenantCertifiedDiscreteAttributeAssignedV3.toBinary(data)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeRevoked" }, ({ data }) =>
      TenantCertifiedDiscreteAttributeRevokedV3.toBinary(data)
    )
    .with({ type: "TenantCertifiedDiscreteAttributeUpdated" }, ({ data }) =>
      TenantCertifiedDiscreteAttributeUpdatedV3.toBinary(data)
    )
    .with({ type: "TenantDeclaredAttributeAssigned" }, ({ data }) =>
      TenantDeclaredAttributeAssignedV3.toBinary(data)
    )
    .with({ type: "TenantDeclaredAttributeRevoked" }, ({ data }) =>
      TenantDeclaredAttributeRevokedV3.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeAssigned" }, ({ data }) =>
      TenantVerifiedAttributeAssignedV3.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeRevoked" }, ({ data }) =>
      TenantVerifiedAttributeRevokedV3.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeExpirationUpdated" }, ({ data }) =>
      TenantVerifiedAttributeExpirationUpdatedV3.toBinary(data)
    )
    .with({ type: "TenantVerifiedAttributeExtensionUpdated" }, ({ data }) =>
      TenantVerifiedAttributeExtensionUpdatedV3.toBinary(data)
    )
    .with({ type: "MaintenanceTenantDeleted" }, ({ data }) =>
      MaintenanceTenantDeletedV3.toBinary(data)
    )
    .with({ type: "MaintenanceTenantUpdated" }, ({ data }) =>
      MaintenanceTenantUpdatedV3.toBinary(data)
    )
    .with({ type: "TenantContactAdded" }, ({ data }) => {
      assertOpaqueContactId(data.contactId);
      return TenantContactAddedV3.toBinary(data);
    })
    .with({ type: "TenantKindUpdated" }, ({ data }) =>
      TenantKindUpdatedV3.toBinary(data)
    )
    .with({ type: "TenantContactDeleted" }, ({ data }) => {
      assertOpaqueContactId(data.contactId);
      return TenantContactDeletedV3.toBinary(data);
    })
    .with({ type: "MaintenanceTenantPromotedToCertifier" }, ({ data }) =>
      MaintenanceTenantPromotedToCertifierV3.toBinary(data)
    )
    .with({ type: "TenantDelegatedProducerFeatureAdded" }, ({ data }) =>
      TenantDelegatedProducerFeatureAddedV3.toBinary(data)
    )
    .with({ type: "TenantDelegatedProducerFeatureRemoved" }, ({ data }) =>
      TenantDelegatedProducerFeatureRemovedV3.toBinary(data)
    )
    .with({ type: "TenantDelegatedConsumerFeatureAdded" }, ({ data }) =>
      TenantDelegatedConsumerFeatureAddedV3.toBinary(data)
    )
    .with({ type: "TenantDelegatedConsumerFeatureRemoved" }, ({ data }) =>
      TenantDelegatedConsumerFeatureRemovedV3.toBinary(data)
    )
    .with({ type: "TenantRemoteIdAssigned" }, ({ data }) =>
      TenantRemoteIdAssignedV3.toBinary(data)
    )
    .with({ type: "MaintenanceTenantRemoteIdDeleted" }, ({ data }) =>
      MaintenanceTenantRemoteIdDeletedV3.toBinary(data)
    )
    .exhaustive();
}

export const TenantEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("TenantCreated"),
    data: protobufDecoder(TenantCreatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("TenantUpdated"),
    data: protobufDecoder(TenantUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("TenantDeleted"),
    data: protobufDecoder(TenantDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("SelfcareMappingCreated"),
    data: protobufDecoder(SelfcareMappingCreatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("SelfcareMappingDeleted"),
    data: protobufDecoder(SelfcareMappingDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("TenantMailAdded"),
    data: protobufDecoder(TenantMailAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("TenantMailDeleted"),
    data: protobufDecoder(TenantMailDeletedV1),
  }),
]);

export type TenantEventV1 = z.infer<typeof TenantEventV1>;

export const TenantEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantOnboarded"),
    data: protobufDecoder(TenantOnboardedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantOnboardDetailsUpdated"),
    data: protobufDecoder(TenantOnboardDetailsUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantCertifiedAttributeAssigned"),
    data: protobufDecoder(TenantCertifiedAttributeAssignedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantCertifiedAttributeRevoked"),
    data: protobufDecoder(TenantCertifiedAttributeRevokedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantCertifiedDiscreteAttributeAssigned"),
    data: protobufDecoder(TenantCertifiedDiscreteAttributeAssignedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantCertifiedDiscreteAttributeRevoked"),
    data: protobufDecoder(TenantCertifiedDiscreteAttributeRevokedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantCertifiedDiscreteAttributeUpdated"),
    data: protobufDecoder(TenantCertifiedDiscreteAttributeUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantDeclaredAttributeAssigned"),
    data: protobufDecoder(TenantDeclaredAttributeAssignedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantDeclaredAttributeRevoked"),
    data: protobufDecoder(TenantDeclaredAttributeRevokedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantVerifiedAttributeAssigned"),
    data: protobufDecoder(TenantVerifiedAttributeAssignedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantVerifiedAttributeRevoked"),
    data: protobufDecoder(TenantVerifiedAttributeRevokedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantVerifiedAttributeExpirationUpdated"),
    data: protobufDecoder(TenantVerifiedAttributeExpirationUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantVerifiedAttributeExtensionUpdated"),
    data: protobufDecoder(TenantVerifiedAttributeExtensionUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("MaintenanceTenantDeleted"),
    data: protobufDecoder(MaintenanceTenantDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("MaintenanceTenantUpdated"),
    data: protobufDecoder(MaintenanceTenantUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantMailAdded"),
    data: protobufDecoder(TenantMailAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantKindUpdated"),
    data: protobufDecoder(TenantKindUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantMailDeleted"),
    data: protobufDecoder(TenantMailDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("MaintenanceTenantPromotedToCertifier"),
    data: protobufDecoder(MaintenanceTenantPromotedToCertifierV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantDelegatedProducerFeatureAdded"),
    data: protobufDecoder(TenantDelegatedProducerFeatureAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantDelegatedProducerFeatureRemoved"),
    data: protobufDecoder(TenantDelegatedProducerFeatureRemovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantDelegatedConsumerFeatureAdded"),
    data: protobufDecoder(TenantDelegatedConsumerFeatureAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantDelegatedConsumerFeatureRemoved"),
    data: protobufDecoder(TenantDelegatedConsumerFeatureRemovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantRemoteIdAssigned"),
    data: protobufDecoder(TenantRemoteIdAssignedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("MaintenanceTenantRemoteIdDeleted"),
    data: protobufDecoder(MaintenanceTenantRemoteIdDeletedV2),
  }),
]);

export type TenantEventV2 = z.infer<typeof TenantEventV2>;

export const TenantEventV3 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantOnboarded"),
    data: protobufDecoder(TenantOnboardedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantOnboardDetailsUpdated"),
    data: protobufDecoder(TenantOnboardDetailsUpdatedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantCertifiedAttributeAssigned"),
    data: protobufDecoder(TenantCertifiedAttributeAssignedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantCertifiedAttributeRevoked"),
    data: protobufDecoder(TenantCertifiedAttributeRevokedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantCertifiedDiscreteAttributeAssigned"),
    data: protobufDecoder(TenantCertifiedDiscreteAttributeAssignedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantCertifiedDiscreteAttributeRevoked"),
    data: protobufDecoder(TenantCertifiedDiscreteAttributeRevokedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantCertifiedDiscreteAttributeUpdated"),
    data: protobufDecoder(TenantCertifiedDiscreteAttributeUpdatedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantDeclaredAttributeAssigned"),
    data: protobufDecoder(TenantDeclaredAttributeAssignedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantDeclaredAttributeRevoked"),
    data: protobufDecoder(TenantDeclaredAttributeRevokedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantVerifiedAttributeAssigned"),
    data: protobufDecoder(TenantVerifiedAttributeAssignedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantVerifiedAttributeRevoked"),
    data: protobufDecoder(TenantVerifiedAttributeRevokedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantVerifiedAttributeExpirationUpdated"),
    data: protobufDecoder(TenantVerifiedAttributeExpirationUpdatedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantVerifiedAttributeExtensionUpdated"),
    data: protobufDecoder(TenantVerifiedAttributeExtensionUpdatedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("MaintenanceTenantDeleted"),
    data: protobufDecoder(MaintenanceTenantDeletedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("MaintenanceTenantUpdated"),
    data: protobufDecoder(MaintenanceTenantUpdatedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantContactAdded"),
    data: protobufDecoder(TenantContactAddedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantKindUpdated"),
    data: protobufDecoder(TenantKindUpdatedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantContactDeleted"),
    data: protobufDecoder(TenantContactDeletedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("MaintenanceTenantPromotedToCertifier"),
    data: protobufDecoder(MaintenanceTenantPromotedToCertifierV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantDelegatedProducerFeatureAdded"),
    data: protobufDecoder(TenantDelegatedProducerFeatureAddedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantDelegatedProducerFeatureRemoved"),
    data: protobufDecoder(TenantDelegatedProducerFeatureRemovedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantDelegatedConsumerFeatureAdded"),
    data: protobufDecoder(TenantDelegatedConsumerFeatureAddedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantDelegatedConsumerFeatureRemoved"),
    data: protobufDecoder(TenantDelegatedConsumerFeatureRemovedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("TenantRemoteIdAssigned"),
    data: protobufDecoder(TenantRemoteIdAssignedV3),
  }),
  z.object({
    event_version: z.literal(3),
    type: z.literal("MaintenanceTenantRemoteIdDeleted"),
    data: protobufDecoder(MaintenanceTenantRemoteIdDeletedV3),
  }),
]);

export type TenantEventV3 = z.infer<typeof TenantEventV3>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();
const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();
const eventV3 = z
  .object({
    event_version: z.literal(3),
  })
  .passthrough();

export const TenantEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2, eventV3])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => TenantEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => TenantEventV2.safeParse(obj))
      .with({ event_version: 3 }, () => TenantEventV3.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type TenantEvent = z.infer<typeof TenantEvent>;

export const TenantEventEnvelopeV1 = EventEnvelope(TenantEventV1);
export type TenantEventEnvelopeV1 = z.infer<typeof TenantEventEnvelopeV1>;

export const TenantEventEnvelopeV2 = EventEnvelope(TenantEventV2);
export type TenantEventEnvelopeV2 = z.infer<typeof TenantEventEnvelopeV2>;

export const TenantEventEnvelopeV3 = EventEnvelope(TenantEventV3);
export type TenantEventEnvelopeV3 = z.infer<typeof TenantEventEnvelopeV3>;

export const TenantEventEnvelope = EventEnvelope(TenantEvent);
export type TenantEventEnvelope = z.infer<typeof TenantEventEnvelope>;
