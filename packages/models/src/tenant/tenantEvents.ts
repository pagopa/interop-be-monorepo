import { match } from "ts-pattern";
import { z } from "zod";
import {
  TenantCreatedV1,
  TenantUpdatedV1,
  TenantDeletedV1,
  SelfcareMappingCreatedV1,
  SelfcareMappingDeletedV1,
} from "../gen/v1/tenant/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export function tenantEventToBinaryData(event: TenantEvent): Uint8Array {
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
    .exhaustive();
}

export const TenantEvent = z.discriminatedUnion("type", [
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
]);

export type TenantEvent = z.infer<typeof TenantEvent>;

export const TenantEventEnvelope = EventEnvelope(TenantEvent);
export type TenantEventEnvelope = z.infer<typeof TenantEventEnvelope>;
