/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  CatalogTopicConfig,
  catalogTopicConfig,
  getContext,
  kafkaConsumerConfig,
  logger,
  loggerConfig,
  messageDecoderSupplier,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { toCatalogItemEventNotification } from "./models/catalogItemEventNotificationConverter.js";
import { buildCatalogMessage } from "./models/catalogItemEventNotificationMessage.js";
import { initQueueManager } from "./queue-manager/queueManager.js";
import { notificationConfig } from "./config/notificationConfig.js";

const config = kafkaConsumerConfig();
const topicsConfig = catalogTopicConfig();
const logConfig = loggerConfig();
const queueConfig = notificationConfig();
const queueManager = initQueueManager({
  queueUrl: queueConfig.queueUrl,
  messageGroupId: "message_group_all_notification",
  logLevel: logConfig.logLevel,
});

export function processMessage(topicConfig: CatalogTopicConfig) {
  return async (kafkaMessage: EachMessagePayload): Promise<void> => {
    const messageDecoder = messageDecoderSupplier(
      topicConfig,
      kafkaMessage.topic
    );

    const decodedMessage = messageDecoder(kafkaMessage.message);

    const ctx = getContext();
    ctx.messageData = {
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
    };
    ctx.correlationId = decodedMessage.correlation_id || uuidv4();

    if (decodedMessage.event_version !== 2) {
      logger.info(`Event with version ${decodedMessage.event_version} skipped`);
      return;
    }

    const eserviceV1Event = toCatalogItemEventNotification(decodedMessage);
    const message = buildCatalogMessage(decodedMessage, eserviceV1Event);
    await queueManager.send(message);

    logger.info(
      `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${decodedMessage.type}"`
    );
  };
}

await runConsumer(
  config,
  [topicsConfig.catalogTopic],
  processMessage(topicsConfig)
);
