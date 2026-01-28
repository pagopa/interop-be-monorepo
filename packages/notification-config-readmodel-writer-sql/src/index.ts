import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  NotificationConfigEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";
import { notificationConfigReadModelWriteServiceBuilder } from "./readModelWriteService.js";

const db = makeDrizzleConnection(config);
const notificationConfigReadModelWriteService =
  notificationConfigReadModelWriteServiceBuilder(db);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, NotificationConfigEvent);

  const loggerInstance = logger({
    serviceName: "notification-config-readmodel-writer-sql",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, notificationConfigReadModelWriteService, loggerInstance)
    )
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.notificationConfigTopic], processMessage);
