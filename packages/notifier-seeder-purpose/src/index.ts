/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  PurposeTopicConfig,
  kafkaConsumerConfig,
  logger,
  loggerConfig,
  messageDecoderSupplier,
  purposeTopicConfig,
  runWithContext,
} from "pagopa-interop-commons";
import { initQueueManager } from "./queue-manager/queueManager.js";
import { notificationConfig } from "./config/notificationConfig.js";
import { toPurposeEventNotification } from "./models/purposeEventNotificationConverter.js";
import { buildPurposeMessage } from "./models/purposeEventNotificationMessage.js";

const config = kafkaConsumerConfig();
const topicsConfig = purposeTopicConfig();
const logConfig = loggerConfig();
const queueConfig = notificationConfig();
const queueManager = initQueueManager({
  queueUrl: queueConfig.queueUrl,
  messageGroupId: "message_group_all_notification",
  logLevel: logConfig.logLevel,
});

export function processMessage(topicConfig: PurposeTopicConfig) {
  return async (kafkaMessage: EachMessagePayload): Promise<void> => {
    const messageDecoder = messageDecoderSupplier(
      topicConfig,
      kafkaMessage.topic
    );

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

        const purposeNotificationV1Event =
          toPurposeEventNotification(decodedMessage);
        const message = buildPurposeMessage(
          decodedMessage,
          purposeNotificationV1Event
        );
        await queueManager.send(message);

        logger.info(
          `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${decodedMessage.type}"`
        );
      }
    );
  };
}

// to do: add purpose events

await runConsumer(
  config,
  [topicsConfig.purposeTopic],
  processMessage(topicsConfig)
);
