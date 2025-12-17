/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  AgreementEventV2,
  AuthorizationEventV2,
  CorrelationId,
  EServiceEventV2,
  generateId,
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { toCatalogItemEventNotification } from "./models/catalog/catalogItemEventNotificationConverter.js";
import { buildCatalogMessage } from "./models/catalog/catalogItemEventNotificationMessage.js";
import { initQueueManager } from "./queue-manager/queueManager.js";
import { toPurposeEventNotification } from "./models/purpose/purposeEventNotificationConverter.js";
import { buildPurposeMessage } from "./models/purpose/purposeEventNotificationMessage.js";
import { toAgreementEventNotification } from "./models/agreement/agreementEventNotificationConverter.js";
import { buildAgreementMessage } from "./models/agreement/agreementEventNotificationMessage.js";
import { toAuthorizationEventNotification } from "./models/authorization/authorizationEventNotificationConverter.js";
import { buildAuthorizationMessage } from "./models/authorization/authorizationEventNotificationMessage.js";
import { config } from "./config/config.js";

const queueManager = initQueueManager({
  queueUrl: config.queueUrl,
  messageGroupId: "message_group_all_notification",
  logLevel: config.logLevel,
});

async function processMessage(kafkaMessage: EachMessagePayload): Promise<void> {
  const { message, decodedMessage } = match(kafkaMessage.topic)
    .with(config.catalogTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        kafkaMessage.message,
        EServiceEventV2
      );

      const event = toCatalogItemEventNotification(decodedMessage);
      const message = buildCatalogMessage(decodedMessage, event);
      return { decodedMessage, message };
    })
    .with(config.purposeTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        kafkaMessage.message,
        PurposeEventV2
      );

      const event = toPurposeEventNotification(decodedMessage);
      const message = event
        ? buildPurposeMessage(decodedMessage, event)
        : undefined;
      return { decodedMessage, message };
    })
    .with(config.agreementTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        kafkaMessage.message,
        AgreementEventV2
      );

      const event = toAgreementEventNotification(decodedMessage);
      const message = event 
        ? buildAgreementMessage(decodedMessage, event)
        : undefined;
      return { decodedMessage, message };
    })
    .with(config.authorizationTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        kafkaMessage.message,
        AuthorizationEventV2
      );

      const event = toAuthorizationEventNotification(decodedMessage);

      const message = event
        ? buildAuthorizationMessage(decodedMessage, event)
        : undefined;
      return { decodedMessage, message };
    })
    .otherwise(() => {
      throw new Error(`Unknown topic: ${kafkaMessage.topic}`);
    });

  if (message) {
    const loggerInstance = logger({
      serviceName: "notifier-seeder",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      streamVersion: decodedMessage.version,
      correlationId: decodedMessage.correlation_id
        ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
        : generateId<CorrelationId>(),
    });
    if (decodedMessage.event_version !== 2) {
      loggerInstance.info(
        `Event with version ${decodedMessage.event_version} skipped`
      );
      return;
    }

    await queueManager.send(message, loggerInstance);

    loggerInstance.info(
      `Notification message [${message.messageUUID}] sent to queue ${config.queueUrl} for event type "${decodedMessage.type}"`
    );
  }
}

await runConsumer(
  config,
  [
    config.catalogTopic,
    config.purposeTopic,
    config.agreementTopic,
    config.authorizationTopic,
  ],
  processMessage,
  "notifier-seeder"
);
