/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { KafkaMessage } from "kafkajs";
import { z } from "zod";

export const EventEnvelope = <TEventZodType extends z.ZodType>(
  event: TEventZodType
) =>
  z.intersection(
    z.object({
      sequence_num: z.number(),
      stream_id: z.string().uuid(),
      version: z.number(),
    }),
    event
  );
type EventEnvelopeT<TEventZodType extends z.ZodType> = ReturnType<
  typeof EventEnvelope<TEventZodType>
>;
export type EventEnvelope<TEvent> = z.infer<EventEnvelopeT<z.ZodType<TEvent>>>;

export const DebeziumCreatePayload = <TEventZodType extends z.ZodType>(
  event: TEventZodType
) =>
  z.object({
    op: z.enum(["c", "r"]),
    after: EventEnvelope(event),
  });
type DebeziumCreatePayloadT<TEventZodType extends z.ZodType> = ReturnType<
  typeof DebeziumCreatePayload<TEventZodType>
>;
export type DebeziumCreatePayload<TEvent> = z.infer<
  DebeziumCreatePayloadT<z.ZodType<TEvent>>
>;

export const Message = <TEventZodType extends z.ZodType>(
  event: TEventZodType
) =>
  z.object({
    value: z.preprocess(
      (v) => (v != null ? JSON.parse(v.toString()) : null),
      DebeziumCreatePayload(EventEnvelope(event))
    ),
  });
type MessageT<TEventZodType extends z.ZodType> = ReturnType<
  typeof Message<TEventZodType>
>;
export type Message<TEvent> = z.infer<MessageT<z.ZodType<TEvent>>>;

export function decodeKafkaMessage<TEvent extends z.ZodType>(
  message: KafkaMessage,
  event: TEvent
) {
  const parsed = Message(event).safeParse(message);
  if (!parsed.success) {
    throw new Error("Invalid message: " + JSON.stringify(parsed.error));
  } else if (!parsed.data.value?.after) {
    throw new Error(
      "Invalid message: missing value " + JSON.stringify(parsed.data)
    );
  }
  return parsed.data.value.after;
}
