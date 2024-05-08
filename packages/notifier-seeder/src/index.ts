/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  CatalogTopicConfig,
  PurposeTopicConfig,
  catalogTopicConfig,
  decodeKafkaMessage,
  kafkaConsumerConfig,
  logger,
  loggerConfig,
  purposeTopicConfig,
  runWithContext,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { EServiceEvent, PurposeEventV2 } from "pagopa-interop-models";
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
  catalogTopic: CatalogTopicConfig,
  purposeTopic: PurposeTopicConfig
) {
  return async (kafkaMessage: EachMessagePayload): Promise<void> => {
    await match(kafkaMessage.topic)
      .with(catalogTopic.catalogTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          kafkaMessage.message,
          EServiceEvent
        );

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

            const eserviceV1Event =
              toCatalogItemEventNotification(decodedMessage);
            const message = buildCatalogMessage(
              decodedMessage,
              eserviceV1Event
            );
            await queueManager.send(message);

            logger.info(
              `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${decodedMessage.type}"`
            );
          }
        );
      })
      .with(purposeTopic.purposeTopic, async () => {
        const decodedMessage = decodeKafkaMessage(
          kafkaMessage.message,
          PurposeEventV2
        );

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

            const purposeV1Event = toPurposeEventNotification(decodedMessage);
            const message = buildPurposeMessage(decodedMessage, purposeV1Event);
            await queueManager.send(message);

            logger.info(
              `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${decodedMessage.type}"`
            );
          }
        );
      })
      .otherwise(() => {
        throw new Error(`Unknown topic: ${kafkaMessage.topic}`);
      });
  };
}

await runConsumer(
  config,
  [catalogTopicConf.catalogTopic, purposeTopicConf.purposeTopic],
  processMessage(catalogTopicConf, purposeTopicConf)
);
