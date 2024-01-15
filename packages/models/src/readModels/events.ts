/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { KafkaMessage } from "kafkajs";
import { ZodType, z } from "zod";

export const EventEnvelope = <T extends z.ZodType>(event: T) =>
  z.intersection(
    z.object({
      sequence_num: z.number(),
      stream_id: z.string().uuid(),
      version: z.number(),
    }),
    event
  );
export type EventEnvelope<T> = typeof EventEnvelope<ZodType<T>>;

export const DebeziumCreatePayload = <T extends z.ZodType>(eventEnvelope: T) =>
  z.object({
    op: z.enum(["c", "r"]),
    after: eventEnvelope,
  });

export const Message = <T extends z.ZodType>(debeziumCreatePayload: T) =>
  z.object({
    value: z.preprocess(
      (v) => (v != null ? JSON.parse(v.toString()) : null),
      debeziumCreatePayload
    ),
  });

export function decodeKafkaMessage<T extends z.ZodType>(
  message: KafkaMessage,
  messageZodType: T
): EventEnvelope<T> {
  const parsed = messageZodType.safeParse(message);
  if (!parsed.success) {
    throw new Error("Invalid message: " + JSON.stringify(parsed.error));
  }
  return parsed.data.value.after;
}
