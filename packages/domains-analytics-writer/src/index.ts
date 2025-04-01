import { EachBatchPayload, EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  genericLogger,
  logger,
} from "pagopa-interop-commons";
import {
  genericInternalError,
  unsafeBrandId,
  generateId,
  CorrelationId,
  EServiceEvent,
  AgreementEvent,
  PurposeEvent,
  AuthorizationEvent,
  AttributeEvent,
  DelegationEvent,
  TenantEvent,
  EServiceTemplateEvent,
} from "pagopa-interop-models";
import { runBatchConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import {
  baseConsumerConfig,
  config,
  batchConsumerConfig,
} from "./config/config.js";
import { handleCatalogMessageV1 } from "./handlers/catalog/consumerServiceV1.js";
import { handleAgreementMessageV1 } from "./handlers/agreement/consumerServiceV1.js";
import { handleAgreementMessageV2 } from "./handlers/agreement/consumerServiceV2.js";
import { handlePurposeMessageV1 } from "./handlers/purpose/consumerServiceV1.js";
import { handlePurposeMessageV2 } from "./handlers/purpose/consumerServiceV2.js";
import { handleAuthorizationMessageV1 } from "./handlers/authorization/consumerServiceV1.js";
import { handleAuthorizationEventMessageV2 } from "./handlers/authorization/consumerServiceV2.js";
import { handleDelegationMessageV2 } from "./handlers/delegation/consumerServiceV2.js";
import { handleTenantMessageV1 } from "./handlers/tenant/consumerServiceV1.js";
import { handleCatalogMessageV2 } from "./handlers/catalog/consumerServiceV2.js";
import { handleAttributeMessageV1 } from "./handlers/attribute/consumerServiceV1.js";
import { handleTenantMessageV2 } from "./handlers/tenant/consumerServiceV2.js";
import { handleEserviceTemplateMessageV2 } from "./handlers/eservice-template/consumerServiceV2.js";
import { DBContext, initDB } from "./db/db.js";
import { setupDbServiceBuilder } from "./service/setupDbService.js";
import { retryConnection } from "./db/buildColumnSet.js";

const dbInstance = initDB({
  username: config.dbUsername,
  password: config.dbPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  useSSL: config.dbUseSSL,
  maxConnectionPool: config.dbMaxConnectionPool,
});

const connection = await dbInstance.connect();
const dbContext: DBContext = {
  conn: connection,
  pgp: dbInstance.$config.pgp,
};

await retryConnection(
  dbInstance,
  dbContext,
  config,
  async (db) => {
    await setupDbServiceBuilder(db.conn, config).setupStagingTables([
      "eservice",
      "eservice_template_ref",
      "eservice_descriptor",
      "eservice_descriptor_template_version_ref",
      "eservice_descriptor_rejection_reason",
      "eservice_descriptor_interface",
      "eservice_descriptor_document",
      "eservice_descriptor_attribute",
      "eservice_risk_analysis",
      "eservice_risk_analysis_answer",
      "eservice_deleting",
    ]);
  },
  logger({ serviceName: "" })
);

async function processMessage(
  messagePayload: EachMessagePayload
): Promise<void> {
  const { decodedMessage, handler } = match(messagePayload.topic)
    .with(config.catalogTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        EServiceEvent
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleCatalogMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleCatalogMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.agreementTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        AgreementEvent
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAgreementMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAgreementMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.attributeTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        AttributeEvent
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAttributeMessageV1.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.purposeTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        PurposeEvent
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handlePurposeMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handlePurposeMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.tenantTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        TenantEvent
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleTenantMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleTenantMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.authorizationTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        AuthorizationEvent
      );

      return match(decodedMessage)
        .with({ event_version: 1 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAuthorizationMessageV1.bind(null, decodedMessage),
        }))
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleAuthorizationEventMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.delegationTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        DelegationEvent
      );

      return match(decodedMessage)
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleDelegationMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .with(config.eserviceTemplateTopic, () => {
      const decodedMessage = decodeKafkaMessage(
        messagePayload.message,
        EServiceTemplateEvent
      );

      return match(decodedMessage)
        .with({ event_version: 2 }, (decodedMessage) => ({
          decodedMessage,
          handler: handleEserviceTemplateMessageV2.bind(null, decodedMessage),
        }))
        .exhaustive();
    })
    .otherwise(() => {
      throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
    });

  const correlationId: CorrelationId = decodedMessage.correlation_id
    ? unsafeBrandId(decodedMessage.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "domains-analytics-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decodedMessage.type} message - Partition ${messagePayload.partition} - Offset ${messagePayload.message.offset}`
  );

  await handler(dbContext);
}

async function processBatch({
  batch,
  heartbeat,
  pause,
}: EachBatchPayload): Promise<void> {
  for (const message of batch.messages) {
    await processMessage({
      topic: batch.topic,
      partition: batch.partition,
      heartbeat,
      pause,
      message,
    });
  }

  genericLogger.info(
    `Handling domains analytics messages. Partition number: ${
      batch.partition
    }. Offset: ${batch.firstOffset()} -> ${batch.lastOffset()}`
  );
}

await runBatchConsumer(
  baseConsumerConfig,
  batchConsumerConfig,
  [
    config.attributeTopic,
    config.agreementTopic,
    config.catalogTopic,
    config.purposeTopic,
    config.tenantTopic,
    config.delegationTopic,
    config.authorizationTopic,
    config.eserviceTemplateTopic,
  ],
  processBatch
);
