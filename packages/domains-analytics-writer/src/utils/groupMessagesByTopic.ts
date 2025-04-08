/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";

/**
 * Groups an array of message payloads by their topic.
 *
 * @param messagesPayloads - Array of message payloads, each containing a `topic` field
 * @returns An object where each key is a topic and the value is an array of payloads for that topic
 */
export function groupMessagesByTopic(
  messagesPayloads: EachMessagePayload[]
): Record<string, EachMessagePayload[]> {
  const messagesByTopic: Record<string, EachMessagePayload[]> = {};
  for (const payload of messagesPayloads) {
    (messagesByTopic[payload.topic] ||= []).push(payload);
  }
  return messagesByTopic;
}
