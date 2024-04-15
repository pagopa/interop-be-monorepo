/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import { EachMessagePayload, KafkaMessage } from "kafkajs";
import {
  EServiceEvent,
  EServiceEventEnvelope,
  Message,
  PurposeEvent,
  PurposeEventEnvelope,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  CatalogTopicConfig,
  KafkaTopicConfig,
  PurposeTopicConfig,
} from "../config/kafkaTopicConfig.js";

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
 *
 * @param {string} topic - The topic of the Kafka message.
 * @param {KafkaTopicConfig} topic configuration.
 * @returns {(message: KafkaMessage) => unknown} - The message decoder function.
 * @throws {Error} - If the topic is unknown and no decoder is available.
 */
export function messageDecoderSupplier(
  topicConfig: CatalogTopicConfig,
  topic: EachMessagePayload["topic"]
): (message: KafkaMessage) => EServiceEventEnvelope;
export function messageDecoderSupplier(
  topicConfig: PurposeTopicConfig,
  topic: EachMessagePayload["topic"]
): (message: KafkaMessage) => PurposeEventEnvelope;
export function messageDecoderSupplier(
  topicConfig: KafkaTopicConfig,
  topic: EachMessagePayload["topic"]
) {
  return match(topicConfig)
    .with(
      { catalogTopic: P.string },
      () => (message: KafkaMessage) =>
        decodeKafkaMessage(message, EServiceEvent)
    )
    .with(
      { purposeTopic: P.string },
      () => (message: KafkaMessage) => decodeKafkaMessage(message, PurposeEvent)
    )
    .otherwise(() => {
      throw new Error(`Topic decoder not found for provided topic : ${topic}`);
    });
}
