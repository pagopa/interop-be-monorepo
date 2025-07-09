/* eslint-disable sonarjs/no-identical-functions */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import {
  AgreementEventV2,
  CorrelationId,
  EServiceEventV2,
  generateId,
  genericInternalError,
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { emailNotificationDispatcherServiceBuilder } from "./services/emailNotificationDispatcherService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { handleEvent } from "./handlers/eventHandler.js";

interface TopicNames {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
}

const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

const emailNotificationDispatcherService =
  emailNotificationDispatcherServiceBuilder();

function processMessage(topicHandlers: TopicNames) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    const { catalogTopic, agreementTopic, purposeTopic } = topicHandlers;

    const eventType = match(messagePayload.topic)
      .with(catalogTopic, () => EServiceEventV2)
      .with(agreementTopic, () => AgreementEventV2)
      .with(purposeTopic, () => PurposeEventV2)
      .otherwise(() => {
        throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
      });

    const decodedMessage = decodeKafkaMessage(
      messagePayload.message,
      eventType
    );

    const loggerInstance = logger({
      serviceName: "email-notification-dispatcher",
      eventType: decodedMessage.type,
      eventVersion: decodedMessage.event_version,
      streamId: decodedMessage.stream_id,
      streamVersion: decodedMessage.version,
      correlationId: decodedMessage.correlation_id
        ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
        : generateId<CorrelationId>(),
    });
    loggerInstance.info(
      `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
    );

    const emailNotificationMessagePayloads = await handleEvent(
      decodedMessage,
      loggerInstance,
      readModelService
    );

    emailNotificationMessagePayloads.forEach((messagePayload) =>
      emailNotificationDispatcherService.sendMessage(
        decodedMessage.stream_id,
        messagePayload
      )
    );
  };
}

await runConsumer(
  config,
  [config.catalogTopic, config.agreementTopic, config.purposeTopic],
  processMessage({
    catalogTopic: config.catalogTopic,
    agreementTopic: config.agreementTopic,
    purposeTopic: config.purposeTopic,
  })
);
