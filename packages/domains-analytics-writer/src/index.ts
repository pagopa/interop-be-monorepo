/* eslint-disable functional/immutable-data */
import { EachBatchPayload, KafkaMessage } from "kafkajs";
import { genericLogger, initDB, logger } from "pagopa-interop-commons";

import { runBatchConsumer } from "kafka-iam-auth";
import {
  baseConsumerConfig,
  config,
  batchConsumerConfig,
} from "./config/config.js";
import { DBContext } from "./db/db.js";
import { setupDbServiceBuilder } from "./service/setupDbService.js";
import { retryConnection } from "./db/buildColumnSet.js";
import {
  AgreementDbTable,
  AttributeDbtable,
  CatalogDbTable,
  DeletingDbTable,
} from "./model/db.js";
import { executeTopicHandler } from "./handlers/batchMessageHandler.js";

const dbInstance = initDB({
  username: config.dbUsername,
  password: config.dbPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  useSSL: config.dbUseSSL,
  schema: config.dbSchemaName,
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
    const setupDbService = setupDbServiceBuilder(db.conn, config);
    await setupDbService.setupStagingTables([
      AttributeDbtable.attribute,
      CatalogDbTable.eservice,
      CatalogDbTable.eservice_template_ref,
      CatalogDbTable.eservice_descriptor,
      CatalogDbTable.eservice_descriptor_template_version_ref,
      CatalogDbTable.eservice_descriptor_rejection_reason,
      CatalogDbTable.eservice_descriptor_interface,
      CatalogDbTable.eservice_descriptor_document,
      CatalogDbTable.eservice_descriptor_attribute,
      CatalogDbTable.eservice_risk_analysis,
      CatalogDbTable.eservice_risk_analysis_answer,
      AgreementDbTable.agreement,
      AgreementDbTable.agreement_stamp,
      AgreementDbTable.agreement_attribute,
      AgreementDbTable.agreement_consumer_document,
      AgreementDbTable.agreement_contract,
    ]);
    await setupDbService.setupStagingDeletingByIdTables([
      DeletingDbTable.attribute_deleting_table,
      DeletingDbTable.catalog_deleting_table,
      DeletingDbTable.agreement_deleting_table,
    ]);
  },
  logger({ serviceName: config.serviceName })
);

async function processBatch({ batch }: EachBatchPayload): Promise<void> {
  const messages: KafkaMessage[] = batch.messages;

  await executeTopicHandler(messages, batch.topic, dbContext);

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
