/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { Message } from "pagopa-interop-models";

/**
 * Minimal KafkaMessage type compatible with both kafkajs and
 * @confluentinc/kafka-javascript, to avoid a direct dependency on either.
 * Only the properties actually used by commons utilities are required;
 * the rest is kept optional so the type structurally accepts messages
 * from any Kafka client library.
 */
export type KafkaMessage = {
  key?: Buffer | null;
  value: Buffer | null;
  timestamp?: string;
  size?: number;
  attributes?: number;
  offset: string;
  headers?: Record<string, Buffer | string | (Buffer | string)[] | undefined>;
};

/**
 * Decodes a Kafka message using the provided event schema.
 *
 * @param {KafkaMessage} message - The Kafka message to decode.
 * @param {TEvent} event - The event schema to use for decoding.
 * @returns The decoded message payload for the event definition provided.
 * @throws {Error} - If the message is invalid or missing required data.
 */
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
