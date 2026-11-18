import { match } from "ts-pattern";
import { z } from "zod";

import { EventEnvelope } from "../events/events.js";
import { AttributeAddedV1 } from "../gen/v1/attribute/events.js";
import { AttributeSubunitPropagationUpdatedV2 } from "../gen/v2/attribute/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";

export function attributeEventToBinaryData(event: AttributeEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, attributeEventToBinaryDataV1)
    .with({ event_version: 2 }, attributeEventToBinaryDataV2)
    .exhaustive();
}

export function attributeEventToBinaryDataV1(
  event: AttributeEventV1
): Uint8Array {
  return match(event)
    .with({ type: "AttributeAdded" }, ({ data }) =>
      AttributeAddedV1.toBinary(data)
    )
    .exhaustive();
}

export function attributeEventToBinaryDataV2(
  event: AttributeEventV2
): Uint8Array {
  return match(event)
    .with({ type: "AttributeSubunitPropagationUpdated" }, ({ data }) =>
      AttributeSubunitPropagationUpdatedV2.toBinary(data)
    )
    .exhaustive();
}

export const AttributeEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("AttributeAdded"),
    data: protobufDecoder(AttributeAddedV1),
  }),
]);
export type AttributeEventV1 = z.infer<typeof AttributeEventV1>;

export const AttributeEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("AttributeSubunitPropagationUpdated"),
    data: protobufDecoder(AttributeSubunitPropagationUpdatedV2),
  }),
]);
export type AttributeEventV2 = z.infer<typeof AttributeEventV2>;

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

export const AttributeEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => AttributeEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => AttributeEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });
export type AttributeEvent = z.infer<typeof AttributeEvent>;

export const AttributeEventEnvelopeV1 = EventEnvelope(AttributeEventV1);
export type AttributeEventEnvelopeV1 = z.infer<typeof AttributeEventEnvelopeV1>;

export const AttributeEventEnvelopeV2 = EventEnvelope(AttributeEventV2);
export type AttributeEventEnvelopeV2 = z.infer<typeof AttributeEventEnvelopeV2>;

export const AttributeEventEnvelope = EventEnvelope(AttributeEvent);
export type AttributeEventEnvelope = z.infer<typeof AttributeEventEnvelope>;
