/* eslint-disable @typescript-eslint/no-empty-function */
import { EachMessagePayload } from "kafkajs";
import { generateId } from "pagopa-interop-models";
import { EmailNotificationPayload } from "../src/model/emailNotificationPayload.js";

export const correctEventPayload: EmailNotificationPayload = {
  correlationId: generateId(),
  subject: "Subject",
  address: "address@mail.com",
  body: "<b>body</b>",
};

export const kafkaMessagePayload: EachMessagePayload = {
  topic: "kafka-test-topic",
  partition: 0,
  message: {
    key: Buffer.from("kafka-message-key"),
    value: Buffer.from(JSON.stringify(correctEventPayload)),
    timestamp: "0",
    attributes: 0,
    offset: "10",
    size: 100,
  },
  heartbeat: async () => {},
  pause: () => () => {},
};

export const kafkaMessagePayloadWithValue = (
  value: unknown
): EachMessagePayload => ({
  ...kafkaMessagePayload,
  message: {
    ...kafkaMessagePayload.message,
    value: Buffer.from(JSON.stringify(value)),
  },
});
