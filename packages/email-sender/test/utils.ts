/* eslint-disable @typescript-eslint/no-empty-function */
import { EachMessagePayload } from "kafkajs";
import { generateId } from "pagopa-interop-models";
import { EmailNotificationMessagePayload } from "pagopa-interop-models";

export const correctTenantEventPayload: EmailNotificationMessagePayload = {
  correlationId: generateId(),
  email: {
    subject: "Subject",
    body: "<b>body</b>",
  },
  tenantId: generateId(),
  type: "Tenant",
  address: "address@mail.com",
};

const correctUserEventPayload: EmailNotificationMessagePayload = {
  correlationId: generateId(),
  email: {
    subject: "Subject",
    body: "<b>body</b>",
  },
  tenantId: generateId(),
  type: "User",
  userId: generateId(),
};

export const kafkaMessagePayloadTenant: EachMessagePayload = {
  topic: "kafka-test-topic",
  partition: 0,
  message: {
    key: Buffer.from("kafka-message-key"),
    value: Buffer.from(JSON.stringify(correctTenantEventPayload)),
    timestamp: "0",
    attributes: 0,
    offset: "10",
    size: 100,
  },
  heartbeat: async () => {},
  pause: () => () => {},
};

export const kafkaMessagePayloadUser: EachMessagePayload = {
  topic: "kafka-test-topic",
  partition: 0,
  message: {
    key: Buffer.from("kafka-message-key"),
    value: Buffer.from(JSON.stringify(correctUserEventPayload)),
    timestamp: "0",
    attributes: 0,
    offset: "10",
    size: 100,
  },
  heartbeat: async () => {},
  pause: () => () => {},
};

export const kafkaMessagePayloadWithValueTenant = (
  value: unknown
): EachMessagePayload => ({
  ...kafkaMessagePayloadTenant,
  message: {
    ...kafkaMessagePayloadTenant.message,
    value: Buffer.from(JSON.stringify(value)),
  },
});
