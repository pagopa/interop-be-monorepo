/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";

export const EventEnvelope = <TEventZodType extends z.ZodType>(
  event: TEventZodType
) =>
  z.intersection(
    z.object({
      sequence_num: z.number(),
      stream_id: z.string().uuid(),
      version: z.number(),
      correlation_id: z.string().uuid().optional(),
    }),
    event
  );
export type EventEnvelope<TEvent> = z.infer<
  ReturnType<typeof EventEnvelope<z.ZodType<TEvent>>>
>;

export const DebeziumCreatePayload = <TEventZodType extends z.ZodType>(
  event: TEventZodType
) =>
  z.object({
    op: z.enum(["c", "r"]),
    after: EventEnvelope(event),
  });
export type DebeziumCreatePayload<TEvent> = z.infer<
  ReturnType<typeof DebeziumCreatePayload<z.ZodType<TEvent>>>
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
export type Message<TEvent> = z.infer<
  ReturnType<typeof Message<z.ZodType<TEvent>>>
>;
