import z from "zod";

// TODO: remove and use z.nonoptional() after updating to zod 4
const ZodNonOptional = z.custom<NonNullable<unknown>>((v) => v !== undefined);

export type EventSchema<
  TEvent extends EventWithDataAndType = EventWithDataAndType,
> = z.ZodType<TEvent>;

type EventWithDataAndType = {
  data: unknown;
  type: string;
};

export const EventEnvelope = <TEventZodType extends EventSchema>(
  event: TEventZodType
) =>
  z.preprocess(
    (payload) => {
      if (!payload || typeof payload !== "object") {
        throw new Error("Expected event .value.after to be an object");
      }

      const { data, ...rest } = payload as { data: unknown };

      if (typeof data !== "string") {
        throw new Error("Expected event .value.after.data to be a hex string");
      }

      return {
        ...rest,
        data: Uint8Array.from(Buffer.from(data, "hex")),
      };
    },
    z
      .object({
        correlation_id: z.string(),
        log_date: z.coerce.date(),
        sequence_num: z.number(),
        stream_id: z.string().uuid(),
        version: z.number(),
      })
      .and(event)
  );

export type EventEnvelope<TEventZodType extends EventSchema> = z.infer<
  ReturnType<typeof EventEnvelope<TEventZodType>>
>;

const KafkaMessageValue = <TEventZodType extends EventSchema>(
  event: TEventZodType
) =>
  z
    .object({
      after: ZodNonOptional,
    })
    .transform(({ after }) => after)
    .pipe(EventEnvelope(event));

export const KafkaMessageEnvelope = <TEventZodType extends EventSchema>(
  event: TEventZodType
) =>
  z
    .object({
      value: ZodNonOptional,
    })
    .transform((v) => JSON.parse(String(v.value)))
    .pipe(KafkaMessageValue(event));

export type KafkaMessageEnvelope<TEventZodType extends EventSchema> = z.infer<
  ReturnType<typeof KafkaMessageEnvelope<TEventZodType>>
>;
