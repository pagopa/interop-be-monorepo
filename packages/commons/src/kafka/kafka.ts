/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { z } from "zod";
import {
  AgreementEvent,
  AttributeEvent,
  EServiceEvent,
  Message,
  PurposeEvent,
  TenantEvent,
} from "pagopa-interop-models";
import { KafkaMessage } from "kafkajs";
import { P, match } from "ts-pattern";
import { KafkaTopicConfig } from "../config/kafkaTopicConfig.js";

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
export const messageDecoderSupplier = (topicConfig: KafkaTopicConfig) =>
  match(topicConfig)
    .with(
      { catalogTopic: P.string },
      () => (message: KafkaMessage) =>
        decodeKafkaMessage(message, EServiceEvent)
    )
    .with(
      { agreementTopic: P.string },
      () => (message: KafkaMessage) =>
        decodeKafkaMessage(message, AgreementEvent)
    )
    .with(
      { tenantTopic: P.string },
      () => (message: KafkaMessage) => decodeKafkaMessage(message, TenantEvent)
    )
    .with(
      { attributeTopic: P.string },
      () => (message: KafkaMessage) =>
        decodeKafkaMessage(message, AttributeEvent)
    )
    .with(
      { purposeTopic: P.string },
      () => (message: KafkaMessage) => decodeKafkaMessage(message, PurposeEvent)
    )
    .exhaustive();
