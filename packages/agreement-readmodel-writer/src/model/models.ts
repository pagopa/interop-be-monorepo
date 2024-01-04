import { z } from "zod";
import { KafkaMessage } from "kafkajs";
import { AgreementEvent } from "pagopa-interop-models";

const EventEnvelope = z.intersection(
  z.object({
    sequence_num: z.number(),
    stream_id: z.string().uuid(),
    version: z.number(),
  }),
  AgreementEvent
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
