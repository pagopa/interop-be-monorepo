import { KafkaMessage } from "kafkajs";

export function getEventTimestamp(message: KafkaMessage): Date {
  return new Date(
    Number(message.timestamp)
    // ^ kafkajs provides a Unix timestamp in milliseconds, but as a string.
    // JS Date constructor accepts ms since epoch as number.
  );
}
