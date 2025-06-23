/* eslint-disable @typescript-eslint/no-empty-function */
import { EachMessagePayload } from "kafkajs";

export const correctEventPayload = {
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
  heartbeat: async () => { },
  pause: () => () => { },
};
