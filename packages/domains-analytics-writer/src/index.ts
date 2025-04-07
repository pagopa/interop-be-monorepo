/* eslint-disable functional/immutable-data */
import { EachBatchPayload, EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  genericLogger,
  logger,
} from "pagopa-interop-commons";
import {
  genericInternalError,
  EServiceEvent,
  AgreementEvent,
  PurposeEvent,
  AuthorizationEvent,
  AttributeEvent,
  DelegationEvent,
  TenantEvent,
  EServiceTemplateEvent,
  EServiceEventEnvelopeV2,
  EServiceEventEnvelopeV1,
  AgreementEventEnvelopeV1,
  AgreementEventEnvelopeV2,
  PurposeEventEnvelopeV1,
  PurposeEventEnvelopeV2,
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV2,
  AuthorizationEventEnvelopeV1,
  AuthorizationEventEnvelopeV2,
  DelegationEventEnvelopeV2,
  EServiceTemplateEventEnvelopeV2,
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
import { AttributeDbtable } from "./model/db.js";

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
      AttributeDbtable.attribute,
    ]);
    await setupDbServiceBuilder(
      db.conn,
      config
    ).setupStagingDeletingByIdTables();
  },
  logger({ serviceName: config.serviceName })
);

// eslint-disable-next-line sonarjs/cognitive-complexity
async function processBatch({
  batch,
  heartbeat,
  pause,
}: EachBatchPayload): Promise<void> {
  const payloads: EachMessagePayload[] = batch.messages.map((message) => ({
    topic: batch.topic,
    partition: batch.partition,
    heartbeat,
    pause,
    message,
  }));

  const groupsByTopic = payloads.reduce<Record<string, EachMessagePayload[]>>(
    (acc, mp) => {
      (acc[mp.topic] ||= []).push(mp);
      return acc;
    },
    {}
  );

  const promises: Array<Promise<void>> = [];
  for (const [topic, payloadGroup] of Object.entries(groupsByTopic)) {
    const handler = match(topic)
      .with(config.catalogTopic, () => {
        const eserviceV1: EServiceEventEnvelopeV1[] = [];
        const eserviceV2: EServiceEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, EServiceEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 1 }, (msg) => eserviceV1.push(msg))
            .with({ event_version: 2 }, (msg) => eserviceV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) => {
          await Promise.all([
            handleCatalogMessageV1.bind(null, eserviceV1, dbContext)(),
            handleCatalogMessageV2.bind(null, eserviceV2, dbContext)(),
          ]);
        };
      })
      .with(config.agreementTopic, () => {
        const agreementV1: AgreementEventEnvelopeV1[] = [];
        const agreementV2: AgreementEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, AgreementEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 1 }, (msg) => agreementV1.push(msg))
            .with({ event_version: 2 }, (msg) => agreementV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) => {
          await Promise.all([
            handleAgreementMessageV1.bind(null, agreementV1, dbContext)(),
            handleAgreementMessageV2.bind(null, agreementV2, dbContext)(),
          ]);
        };
      })
      .with(config.attributeTopic, () => {
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, AttributeEvent)
        );
        return async (dbContext: DBContext) =>
          handleAttributeMessageV1.bind(null, decodedMessages, dbContext)();
      })
      .with(config.purposeTopic, () => {
        const purposeV1: PurposeEventEnvelopeV1[] = [];
        const purposeV2: PurposeEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, PurposeEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 1 }, (msg) => purposeV1.push(msg))
            .with({ event_version: 2 }, (msg) => purposeV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) => {
          await Promise.all([
            handlePurposeMessageV1.bind(null, purposeV1, dbContext)(),
            handlePurposeMessageV2.bind(null, purposeV2, dbContext)(),
          ]);
        };
      })
      .with(config.tenantTopic, () => {
        const tenantV1: TenantEventEnvelopeV1[] = [];
        const tenantV2: TenantEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, TenantEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 1 }, (msg) => tenantV1.push(msg))
            .with({ event_version: 2 }, (msg) => tenantV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) => {
          await Promise.all([
            handleTenantMessageV1.bind(null, tenantV1, dbContext)(),
            handleTenantMessageV2.bind(null, tenantV2, dbContext)(),
          ]);
        };
      })
      .with(config.authorizationTopic, () => {
        const authV1: AuthorizationEventEnvelopeV1[] = [];
        const authV2: AuthorizationEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, AuthorizationEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 1 }, (msg) => authV1.push(msg))
            .with({ event_version: 2 }, (msg) => authV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) => {
          await Promise.all([
            handleAuthorizationMessageV1.bind(null, authV1, dbContext)(),
            handleAuthorizationEventMessageV2.bind(null, authV2, dbContext)(),
          ]);
        };
      })
      .with(config.delegationTopic, () => {
        const delegationV2: DelegationEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, DelegationEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 2 }, (msg) => delegationV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) =>
          handleDelegationMessageV2.bind(null, delegationV2, dbContext)();
      })
      .with(config.eserviceTemplateTopic, () => {
        const templateV2: EServiceTemplateEventEnvelopeV2[] = [];
        const decodedMessages = payloadGroup.map((mp) =>
          decodeKafkaMessage(mp.message, EServiceTemplateEvent)
        );
        for (const decoded of decodedMessages) {
          match(decoded)
            .with({ event_version: 2 }, (msg) => templateV2.push(msg))
            .exhaustive();
        }
        return async (dbContext: DBContext) =>
          handleEserviceTemplateMessageV2.bind(null, templateV2, dbContext)();
      })
      .otherwise(() => {
        throw genericInternalError(`Unknown topic`);
      });
    promises.push(handler(dbContext));
  }
  await Promise.allSettled(promises);

  genericLogger.info(
    `Handled batch. Partition: ${
      batch.partition
    }. Offsets: ${batch.firstOffset()} -> ${batch.lastOffset()}`
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
