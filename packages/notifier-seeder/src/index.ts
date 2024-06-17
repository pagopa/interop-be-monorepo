/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  AgreementTopicConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  agreementTopicConfig,
  catalogTopicConfig,
  decodeKafkaMessage,
  kafkaConsumerConfig,
  logger,
  loggerConfig,
  purposeTopicConfig,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  AgreementEventV2,
  EServiceEventV2,
  PurposeEventV2,
} from "pagopa-interop-models";
import { toCatalogItemEventNotification } from "./models/catalog/catalogItemEventNotificationConverter.js";
import { buildCatalogMessage } from "./models/catalog/catalogItemEventNotificationMessage.js";
import { initQueueManager } from "./queue-manager/queueManager.js";
import { notificationConfig } from "./config/notificationConfig.js";
import { toPurposeEventNotification } from "./models/purpose/purposeEventNotificationConverter.js";
import { buildPurposeMessage } from "./models/purpose/purposeEventNotificationMessage.js";
import { toAgreementEventNotification } from "./models/agreement/agreementEventNotificationConverter.js";
import { buildAgreementMessage } from "./models/agreement/agreementEventNotificationMessage.js";

const config = kafkaConsumerConfig();
const catalogTopicConf = catalogTopicConfig();
const purposeTopicConf = purposeTopicConfig();
const agreementTopicConf = agreementTopicConfig();
const logConfig = loggerConfig();
const queueConfig = notificationConfig();
const queueManager = initQueueManager({
  queueUrl: queueConfig.queueUrl,
  messageGroupId: "message_group_all_notification",
  logLevel: logConfig.logLevel,
});

export function processMessage(
  catalogTopic: CatalogTopicConfig,
  purposeTopic: PurposeTopicConfig,
  agreementTopic: AgreementTopicConfig
) {
  return async (kafkaMessage: EachMessagePayload): Promise<void> => {
    const { message, decodedMessage } = match(kafkaMessage.topic)
      .with(catalogTopic.catalogTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          kafkaMessage.message,
          EServiceEventV2
        );

        const event = toCatalogItemEventNotification(decodedMessage);
        const message = buildCatalogMessage(decodedMessage, event);
        return { decodedMessage, message };
      })
      .with(purposeTopic.purposeTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          kafkaMessage.message,
          PurposeEventV2
        );

        const event = toPurposeEventNotification(decodedMessage);
        const message = buildPurposeMessage(decodedMessage, event);
        return { decodedMessage, message };
      })
      .with(agreementTopic.agreementTopic, () => {
        const decodedMessage = decodeKafkaMessage(
          kafkaMessage.message,
          AgreementEventV2
        );

        const event = toAgreementEventNotification(decodedMessage);
        const message = buildAgreementMessage(decodedMessage, event);
        return { decodedMessage, message };
      })
      .otherwise(() => {
        throw new Error(`Unknown topic: ${kafkaMessage.topic}`);
      });

    const loggerInstance = logger({
      serviceName: "notifier-seeder",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      correlationId: decodedMessage.correlation_id,
    });
    if (decodedMessage.event_version !== 2) {
      loggerInstance.info(
        `Event with version ${decodedMessage.event_version} skipped`
      );
      return;
    }

    await queueManager.send(message, loggerInstance);

    loggerInstance.info(
      `Notification message [${message.messageUUID}] sent to queue ${queueConfig.queueUrl} for event type "${decodedMessage.type}"`
    );
  };
}

await runConsumer(
  config,
  [
    catalogTopicConf.catalogTopic,
    purposeTopicConf.purposeTopic,
    agreementTopicConf.agreementTopic,
  ],
  processMessage(catalogTopicConf, purposeTopicConf, agreementTopicConf)
);
