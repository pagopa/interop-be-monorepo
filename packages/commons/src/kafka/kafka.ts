/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { EachMessagePayload, KafkaMessage } from "kafkajs";
import { AgreementEvent, EServiceEvent, Message } from "pagopa-interop-models";

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

/**
 * Returns a message decoder function based on the provided topic.
 * NOTE: this function using a regex to match the topic and return the correct decoder,
 * this is a simplest way to handle the different topics without structured topic name and models.
 *
 * @param {string} topic - The topic of the Kafka message.
 * @returns {(message: KafkaMessage) => unknown} - The message decoder function.
 * @throws {Error} - If the topic is unknown and no decoder is available.
 */
export function messageDecoderSupplier(topic: EachMessagePayload["topic"]) {
  if (/\.agreement\./.test(topic)) {
    return (message: KafkaMessage) =>
      decodeKafkaMessage(message, AgreementEvent);
  }
  if (/\.catalog\./.test(topic)) {
    return (message: KafkaMessage) =>
      decodeKafkaMessage(message, EServiceEvent);
  }

  throw new Error(`Topic decoder not found for provided topic : ${topic}`);
}
