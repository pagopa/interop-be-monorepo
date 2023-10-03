import { z, ZodAny, ZodTransformer } from "zod";
import {
  EServiceAddedV1,
  ClonedEServiceAddedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceDeletedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  MovedAttributesFromEserviceToDescriptorsV1,
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
    type: z.literal("EServiceAdded"),
    data: protobufDecoder(EServiceAddedV1),
  }),
  z.object({
    type: z.literal("ClonedEServiceAdded"),
    data: protobufDecoder(ClonedEServiceAddedV1),
  }),
  z.object({
    type: z.literal("EServiceUpdated"),
    data: protobufDecoder(EServiceUpdatedV1),
  }),
  z.object({
    type: z.literal("EServiceWithDescriptorsDeleted"),
    data: protobufDecoder(EServiceWithDescriptorsDeletedV1),
  }),
  z.object({
    type: z.literal("EServiceDocumentUpdated"),
    data: protobufDecoder(EServiceDocumentUpdatedV1),
  }),
  z.object({
    type: z.literal("EServiceDeleted"),
    data: protobufDecoder(EServiceDeletedV1),
  }),
  z.object({
    type: z.literal("EServiceDocumentAdded"),
    data: protobufDecoder(EServiceDocumentAddedV1),
  }),
  z.object({
    type: z.literal("EServiceDocumentDeleted"),
    data: protobufDecoder(EServiceDocumentDeletedV1),
  }),
  z.object({
    type: z.literal("EServiceDescriptorAdded"),
    data: protobufDecoder(EServiceDescriptorAddedV1),
  }),
  z.object({
    type: z.literal("EServiceDescriptorUpdated"),
    data: protobufDecoder(EServiceDescriptorUpdatedV1),
  }),
  z.object({
    type: z.literal("MovedAttributesFromEserviceToDescriptors"),
    data: protobufDecoder(MovedAttributesFromEserviceToDescriptorsV1),
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
  value: z.preprocess((v) => {
    if (v == null) {
      return null;
    }

    const msg = JSON.parse(v.toString());
    if (msg.payload) {
      return { ...msg.payload };
    } else {
      return msg;
    }
  }, DebeziumCreatePayload),
});

export function decodeKafkaMessage(message: KafkaMessage): EventEnvelope {
  const parsed = Message.safeParse(message);
  if (!parsed.success) {
    throw new Error("Invalid message: " + JSON.stringify(parsed.error));
  }
  return parsed.data.value.after;
}
