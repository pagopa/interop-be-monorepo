/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  CatalogTopicConfig,
  PurposeTopicConfig,
  catalogTopicConfig,
  kafkaConsumerConfig,
  logger,
  loggerConfig,
  messageDecoderSupplier,
  purposeTopicConfig,
  runWithContext,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { toCatalogItemEventNotification } from "./models/catalogItemEventNotificationConverter.js";
import { buildCatalogMessage } from "./models/catalogItemEventNotificationMessage.js";
import { initQueueManager } from "./queue-manager/queueManager.js";
import { notificationConfig } from "./config/notificationConfig.js";
import { toPurposeEventNotification } from "./models/purposeEventNotificationConverter.js";
import { buildPurposeMessage } from "./models/purposeEventNotificationMessage.js";

const config = kafkaConsumerConfig();
const catalogTopicConf = catalogTopicConfig();
const purposeTopicConf = purposeTopicConfig();
const logConfig = loggerConfig();
const queueConfig = notificationConfig();
const queueManager = initQueueManager({
  queueUrl: queueConfig.queueUrl,
  messageGroupId: "message_group_all_notification",
  logLevel: logConfig.logLevel,
});

export function processMessage(
  catalogTopicConfig: CatalogTopicConfig,
  purposeTopicConfig: PurposeTopicConfig
) {
  return async (kafkaMessage: EachMessagePayload): Promise<void> => {
    const { messageDecoder, eventParser, messageBuilder } = match(
      kafkaMessage.topic
    )
      .with(catalogTopicConfig.catalogTopic, () => ({
        messageDecoder: messageDecoderSupplier(
          catalogTopicConfig,
          kafkaMessage.topic
        ),
        eventParser: toCatalogItemEventNotification,
        messageBuilder: buildCatalogMessage,
      }))
      .with(purposeTopicConfig.purposeTopic, () => ({
        messageDecoder: messageDecoderSupplier(
          purposeTopicConfig,
          kafkaMessage.topic
        ),
        eventParser: toPurposeEventNotification,
        messageBuilder: buildPurposeMessage,
      }))
      .otherwise(() => {
        throw new Error(`Unknown topic: ${kafkaMessage.topic}`);
      });

    const decodedMessage = messageDecoder(kafkaMessage.message);

    await runWithContext(
      {
        messageData: {
          eventType: decodedMessage.type,
          eventVersion: decodedMessage.event_version,
          streamId: decodedMessage.stream_id,
        },
        correlationId: decodedMessage.correlation_id,
      },
      async () => {
        if (decodedMessage.event_version !== 2) {
          logger.info(
            `Event with version ${decodedMessage.event_version} skipped`
          );
          return;
        }

        const event = eventParser(decodedMessage);
        const message = messageBuilder(decodedMessage, event);
        await queueManager.send(message);

        logger.info(
          `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${decodedMessage.type}"`
        );
      }
    );
  };
}

await runConsumer(
  config,
  [catalogTopicConf.catalogTopic, purposeTopicConf.purposeTopic],
  processMessage(catalogTopicConf, purposeTopicConf)
);
