import { match } from "ts-pattern";
import { z } from "zod";
import { AttributeAddedV1 } from "../gen/v1/attribute/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export function attributeEventToBinaryData(event: AttributeEvent): Uint8Array {
  return match(event)
    .with({ type: "AttributeAdded" }, ({ data }) =>
      AttributeAddedV1.toBinary(data)
    )
    .exhaustive();
}

export const AttributeEvent = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("AttributeAdded"),
    data: protobufDecoder(AttributeAddedV1),
  }),
]);
export type AttributeEvent = z.infer<typeof AttributeEvent>;

export const AttributeEventEnvelope = EventEnvelope(AttributeEvent);
export type AttributeEventEnvelope = z.infer<typeof AttributeEventEnvelope>;
