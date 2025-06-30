import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage, initDB } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  AuthorizationEvent,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./producerKeyConsumerServiceV2.js";
import { config } from "./config/config.js";

const db = initDB({
  username: config.eventStoreDbUsername,
  password: config.eventStoreDbPassword,
  host: config.eventStoreDbHost,
  port: config.eventStoreDbPort,
  database: config.eventStoreDbName,
  schema: config.eventStoreDbSchema,
  useSSL: config.eventStoreDbUseSSL,
});

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AuthorizationEvent);

  const loggerInstance = logger({
    serviceName: "producer-key-events-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, db))
    .with({ event_version: 1 }, () => Promise.resolve())
    .exhaustive();

  loggerInstance.info(
    `Producer Keys Events store Updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.authorizationTopic],
  processMessage,
  "producer-key-events-writer"
);
