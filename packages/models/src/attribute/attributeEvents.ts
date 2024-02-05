import { match } from "ts-pattern";
import { z } from "zod";
import {
  AttributeAddedV1,
  AttributeDeletedV1,
} from "../gen/v1/attribute/events.js";
import { EventEnvelope, protobufDecoder } from "../index.js";

export function attributeEventToBinaryData(event: AttributeEvent): Uint8Array {
  return match(event)
    .with({ type: "AttributeDeleted" }, ({ data }) =>
      AttributeDeletedV1.toBinary(data)
    )
    .with({ type: "AttributeAdded" }, ({ data }) =>
      AttributeAddedV1.toBinary(data)
    )
    .exhaustive();
}

export const AttributeEvent = z.discriminatedUnion("type", [
  z.object({
    eventVersion: z.literal(1),
    type: z.literal("AttributeAdded"),
    data: protobufDecoder(AttributeAddedV1),
  }),
  z.object({
    eventVersion: z.literal(1),
    type: z.literal("AttributeDeleted"),
    data: protobufDecoder(AttributeDeletedV1),
  }),
]);
export type AttributeEvent = z.infer<typeof AttributeEvent>;

export const AttributeEventEnvelope = EventEnvelope(AttributeEvent);
export type AttributeEventEnvelope = z.infer<typeof AttributeEventEnvelope>;
