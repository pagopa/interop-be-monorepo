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
  CatalogDbPartialTable,
  CatalogDbTable,
  DelegationDbTable,
  DeletingDbTable,
  PurposeDbTable,
  TenantDbPartialTable,
  TenantDbTable,
  ClientDbTable,
  ProducerKeychainDbTable,
  PurposeTemplateDbTable,
  ClientDbTablePartialTable,
} from "./model/db/index.js";
import { executeTopicHandler } from "./handlers/batchMessageHandler.js";
import { EserviceTemplateDbTable } from "./model/db/eserviceTemplate.js";

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
      PurposeDbTable.purpose,
      PurposeDbTable.purpose_version,
      PurposeDbTable.purpose_version_document,
      PurposeDbTable.purpose_version_stamp,
      PurposeDbTable.purpose_risk_analysis_form,
      PurposeDbTable.purpose_risk_analysis_answer,
      ClientDbTable.client,
      ClientDbTable.client_purpose,
      ClientDbTable.client_user,
      ClientDbTable.client_key,
      ProducerKeychainDbTable.producer_keychain,
      ProducerKeychainDbTable.producer_keychain_eservice,
      ProducerKeychainDbTable.producer_keychain_user,
      ProducerKeychainDbTable.producer_keychain_key,
      DelegationDbTable.delegation,
      DelegationDbTable.delegation_stamp,
      DelegationDbTable.delegation_contract_document,
      TenantDbTable.tenant,
      TenantDbTable.tenant_mail,
      TenantDbTable.tenant_certified_attribute,
      TenantDbTable.tenant_declared_attribute,
      TenantDbTable.tenant_verified_attribute,
      TenantDbTable.tenant_verified_attribute_verifier,
      TenantDbTable.tenant_verified_attribute_revoker,
      TenantDbTable.tenant_feature,
      EserviceTemplateDbTable.eservice_template,
      EserviceTemplateDbTable.eservice_template_version,
      EserviceTemplateDbTable.eservice_template_version_attribute,
      EserviceTemplateDbTable.eservice_template_version_document,
      EserviceTemplateDbTable.eservice_template_version_interface,
      EserviceTemplateDbTable.eservice_template_risk_analysis,
      EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
      PurposeTemplateDbTable.purpose_template,
      PurposeTemplateDbTable.purpose_template_eservice_descriptor,
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
      PurposeTemplateDbTable.purpose_template_risk_analysis_form,
    ]);
    await setupDbService.setupPartialStagingTables([
      TenantDbPartialTable.tenant_self_care_id,
      CatalogDbPartialTable.descriptor_server_urls,
      ClientDbTablePartialTable.key_relationship_migrated,
    ]);
    await setupDbService.setupStagingDeletingTables([
      { name: DeletingDbTable.attribute_deleting_table, columns: ["id"] },
      { name: DeletingDbTable.catalog_deleting_table, columns: ["id"] },
      {
        name: DeletingDbTable.catalog_descriptor_interface_deleting_table,
        columns: ["id", "descriptorId", "metadataVersion"],
      },
      { name: DeletingDbTable.agreement_deleting_table, columns: ["id"] },
      { name: DeletingDbTable.purpose_deleting_table, columns: ["id"] },
      {
        name: DeletingDbTable.tenant_deleting_table,
        columns: ["id"],
      },
      {
        name: DeletingDbTable.tenant_mail_deleting_table,
        columns: ["id", "tenantId"],
      },
      { name: DeletingDbTable.client_deleting_table, columns: ["id"] },
      {
        name: DeletingDbTable.client_user_deleting_table,
        columns: ["clientId", "userId"],
      },
      {
        name: DeletingDbTable.client_purpose_deleting_table,
        columns: ["clientId", "purposeId"],
      },
      {
        name: DeletingDbTable.client_key_deleting_table,
        columns: ["clientId", "kid", "deleted_at"],
      },
      {
        name: DeletingDbTable.producer_keychain_deleting_table,
        columns: ["id"],
      },
      {
        name: DeletingDbTable.eservice_template_deleting_table,
        columns: ["id"],
      },
      {
        name: DeletingDbTable.purpose_template_deleting_table,
        columns: ["id"],
      },
      {
        name: DeletingDbTable.purpose_template_eservice_descriptor_deleting_table,
        columns: ["purposeTemplateId", "eserviceId", "descriptorId"],
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
  processBatch,
  "domains-analytics-writer"
);
