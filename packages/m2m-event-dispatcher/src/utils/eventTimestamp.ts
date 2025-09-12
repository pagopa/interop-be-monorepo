import { EachMessagePayload } from "kafkajs";

export function getEventTimestamp(m: EachMessagePayload): Date {
  return new Date(
    Number(m.message.timestamp)
    // ^ kafkajs provides a Unix timestamp in milliseconds, but as a string.
    // JS Date constructor accepts ms since epoch as number.
  );
}
