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
  AttributeDbTable,
  CatalogDbTable,
  DeletingDbTable,
  TenantDbPartialTable,
  TenantDbTable,
} from "./model/db/index.js";
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
      AttributeDbTable.attribute,
      CatalogDbTable.eservice,
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
      TenantDbTable.tenant,
      TenantDbTable.tenant_mail,
      TenantDbTable.tenant_certified_attribute,
      TenantDbTable.tenant_declared_attribute,
      TenantDbTable.tenant_verified_attribute,
      TenantDbTable.tenant_verified_attribute_verifier,
      TenantDbTable.tenant_verified_attribute_revoker,
      TenantDbTable.tenant_feature,
    ]);
    await setupDbService.setupPartialStagingTables([
      TenantDbPartialTable.tenant_self_care_id,
    ]);
    await setupDbService.setupStagingDeletingTables([
      { name: DeletingDbTable.attribute_deleting_table, columns: ["id"] },
      { name: DeletingDbTable.catalog_deleting_table, columns: ["id"] },
      { name: DeletingDbTable.agreement_deleting_table, columns: ["id"] },
      {
        name: DeletingDbTable.catalog_risk_deleting_table,
        columns: ["id", "eserviceId"],
      },
      {
        name: DeletingDbTable.tenant_deleting_table,
        columns: ["id"],
      },
      {
        name: DeletingDbTable.tenant_mail_deleting_table,
        columns: ["id"],
      },
      {
        name: DeletingDbTable.tenant_mail_deleting_by_id_and_tenant_table,
        columns: ["id", "tenantId"],
      },
      {
        name: DeletingDbTable.tenant_feature_deleting_table,
        columns: ["tenantId", "kind"],
      },
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
