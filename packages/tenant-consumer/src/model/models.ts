import { z, ZodAny, ZodTransformer } from "zod";
import {
  SelfcareMappingCreatedV1,
  SelfcareMappingDeletedV1,
  TenantCreatedV1,
  TenantDeletedV1,
  TenantUpdatedV1,
} from "pagopa-interop-models";
import { MessageType } from "@protobuf-ts/runtime";
import { KafkaMessage } from "kafkajs";

function protobufDecoder<I extends object>(
  decoder: MessageType<I>
): ZodTransformer<ZodAny, I> {
  return z.any().transform((v) => decoder.fromBinary(Buffer.from(v, "hex")));
}

const Event = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TenantCreated"),
    data: protobufDecoder(TenantCreatedV1),
  }),
  z.object({
    type: z.literal("TenantUpdated"),
    data: protobufDecoder(TenantUpdatedV1),
  }),
  z.object({
    type: z.literal("TenantDeleted"),
    data: protobufDecoder(TenantDeletedV1),
  }),
  z.object({
    type: z.literal("SelfcareMappingCreated"),
    data: protobufDecoder(SelfcareMappingCreatedV1),
  }),
  z.object({
    type: z.literal("SelfcareMappingDeleted"),
    data: protobufDecoder(SelfcareMappingDeletedV1),
  }),
]);

const EventEnvelope = z.intersection(
  z.object({
    sequence_num: z.number(),
    stream_id: z.string().uuid(),
    version: z.number(),
  }),
  Event
);
export type EventEnvelope = z.infer<typeof EventEnvelope>;

const DebeziumCreatePayload = z.object({
  op: z.enum(["c", "r"]),
  after: EventEnvelope,
});

const Message = z.object({
  value: z.preprocess(
    (v) => (v != null ? JSON.parse(v.toString()) : null),
    DebeziumCreatePayload
  ),
});

export function decodeKafkaMessage(message: KafkaMessage): EventEnvelope {
  const parsed = Message.safeParse(message);
  if (!parsed.success) {
    throw new Error("Invalid message: " + JSON.stringify(parsed.error));
  }
  return parsed.data.value.after;
}
