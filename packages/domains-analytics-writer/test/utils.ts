/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import camelcaseKeys from "camelcase-keys";
import { genericLogger } from "pagopa-interop-commons";
import { inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { z } from "zod";
import { DBContext, DBConnection } from "../src/db/db.js";
import { config } from "../src/config/config.js";
import { retryConnection } from "../src/db/buildColumnSet.js";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import {
  AgreementDbTable,
  AttributeDbTable,
  CatalogDbTable,
  DelegationDbTable,
  DeletingDbTable,
  DeletingDbTableConfigMap,
  DomainDbTable,
  DomainDbTableSchemas,
  EserviceTemplateDbTable,
  TenantDbPartialTable,
  PurposeDbTable,
  TenantDbTable,
  CatalogDbPartialTable,
  ClientDbTable,
  ProducerKeychainDbTable,
  PurposeTemplateDbTable,
  ClientDbTablePartialTable,
} from "../src/model/db/index.js";
import { catalogServiceBuilder } from "../src/service/catalogService.js";
import { attributeServiceBuilder } from "../src/service/attributeService.js";
import { getColumnNameMapper } from "../src/utils/sqlQueryHelper.js";

export const { cleanup, analyticsPostgresDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("analyticsSQLConfig"),
);
const connection = await analyticsPostgresDB.connect();

export const dbContext: DBContext = {
  conn: connection,
  pgp: analyticsPostgresDB.$config.pgp,
};

export const attributeTables: AttributeDbTable[] = [AttributeDbTable.attribute];

export const catalogTables: CatalogDbTable[] = [
  CatalogDbTable.eservice,
  CatalogDbTable.eservice_descriptor,
  CatalogDbTable.eservice_descriptor_template_version_ref,
  CatalogDbTable.eservice_descriptor_rejection_reason,
  CatalogDbTable.eservice_descriptor_interface,
  CatalogDbTable.eservice_descriptor_document,
  CatalogDbTable.eservice_descriptor_attribute,
  CatalogDbTable.eservice_risk_analysis,
  CatalogDbTable.eservice_risk_analysis_answer,
];

export const agreementTables: AgreementDbTable[] = [
  AgreementDbTable.agreement,
  AgreementDbTable.agreement_attribute,
  AgreementDbTable.agreement_consumer_document,
  AgreementDbTable.agreement_contract,
  AgreementDbTable.agreement_stamp,
  AgreementDbTable.agreement_signed_contract,
];

export const purposeTables: PurposeDbTable[] = [
  PurposeDbTable.purpose,
  PurposeDbTable.purpose_version,
  PurposeDbTable.purpose_version_document,
  PurposeDbTable.purpose_version_stamp,
  PurposeDbTable.purpose_risk_analysis_form,
  PurposeDbTable.purpose_risk_analysis_answer,
  PurposeDbTable.purpose_version_signed_document,
];

export const delegationTables: DelegationDbTable[] = [
  DelegationDbTable.delegation,
  DelegationDbTable.delegation_stamp,
  DelegationDbTable.delegation_contract_document,
  DelegationDbTable.delegation_signed_contract_document,
];

export const tenantTables: TenantDbTable[] = [
  TenantDbTable.tenant,
  TenantDbTable.tenant_certified_attribute,
  TenantDbTable.tenant_declared_attribute,
  TenantDbTable.tenant_feature,
  TenantDbTable.tenant_mail,
  TenantDbTable.tenant_verified_attribute,
  TenantDbTable.tenant_verified_attribute_revoker,
  TenantDbTable.tenant_verified_attribute_verifier,
];

export const eserviceTemplateTables: EserviceTemplateDbTable[] = [
  EserviceTemplateDbTable.eservice_template,
  EserviceTemplateDbTable.eservice_template_version,
  EserviceTemplateDbTable.eservice_template_version_attribute,
  EserviceTemplateDbTable.eservice_template_version_document,
  EserviceTemplateDbTable.eservice_template_version_interface,
  EserviceTemplateDbTable.eservice_template_risk_analysis,
  EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
];

export const clientTables: ClientDbTable[] = [
  ClientDbTable.client,
  ClientDbTable.client_purpose,
  ClientDbTable.client_user,
  ClientDbTable.client_key,
];

export const producerKeychainTables: ProducerKeychainDbTable[] = [
  ProducerKeychainDbTable.producer_keychain,
  ProducerKeychainDbTable.producer_keychain_eservice,
  ProducerKeychainDbTable.producer_keychain_user,
  ProducerKeychainDbTable.producer_keychain_key,
];

export const purposeTemplateTables: PurposeTemplateDbTable[] = [
  PurposeTemplateDbTable.purpose_template,
  PurposeTemplateDbTable.purpose_template_eservice_descriptor,
  PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
  PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
  PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
  PurposeTemplateDbTable.purpose_template_risk_analysis_form,
];

export const partialTables = [
  TenantDbPartialTable.tenant_self_care_id,
  CatalogDbPartialTable.descriptor_server_urls,
  ClientDbTablePartialTable.key_relationship_migrated,
];

export const deletingTables: DeletingDbTable[] = [
  DeletingDbTable.agreement_deleting_table,
  DeletingDbTable.attribute_deleting_table,
  DeletingDbTable.catalog_deleting_table,
  DeletingDbTable.catalog_descriptor_interface_deleting_table,
  DeletingDbTable.purpose_deleting_table,
  DeletingDbTable.tenant_deleting_table,
  DeletingDbTable.tenant_mail_deleting_table,
  DeletingDbTable.client_deleting_table,
  DeletingDbTable.client_purpose_deleting_table,
  DeletingDbTable.client_user_deleting_table,
  DeletingDbTable.client_key_deleting_table,
  DeletingDbTable.producer_keychain_deleting_table,
  DeletingDbTable.eservice_template_deleting_table,
  DeletingDbTable.purpose_template_deleting_table,
  DeletingDbTable.purpose_template_eservice_descriptor_deleting_table,
];

export const domainTables: DomainDbTable[] = [
  ...attributeTables,
  ...catalogTables,
  ...agreementTables,
  ...purposeTables,
  ...delegationTables,
  ...tenantTables,
  ...clientTables,
  ...producerKeychainTables,
  ...eserviceTemplateTables,
  ...purposeTemplateTables,
];

export const setupStagingDeletingTables: DeletingDbTableConfigMap[] = [
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
];

await retryConnection(
  analyticsPostgresDB,
  dbContext,
  config,
  async (db) => {
    const setupDbService = setupDbServiceBuilder(db.conn, config);
    await setupDbService.setupStagingTables(domainTables);
    await setupDbService.setupPartialStagingTables(partialTables);
    await setupDbService.setupStagingDeletingTables(setupStagingDeletingTables);
  },
  genericLogger,
);

export async function resetTargetTables(
  tables: DomainDbTable[]
): Promise<void> {
  await dbContext.conn.none(`TRUNCATE TABLE ${tables.join(",")} CASCADE;`);
}
export const attributeService = attributeServiceBuilder(dbContext);
export const catalogService = catalogServiceBuilder(dbContext);
export const setupDbService = setupDbServiceBuilder(dbContext.conn, config);

export async function getTablesByName(
  db: DBConnection,
  tables: string[],
): Promise<Array<{ tablename: string }>> {
  const query = `
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname LIKE 'pg_temp%' 
        AND tablename IN ($1:csv);
    `;
  return await db.query<Array<{ tablename: string }>>(query, [tables]);
}

export async function getOneFromDb<T extends DomainDbTable>(
  db: DBContext,
  tableName: T,
  where: Partial<z.infer<DomainDbTableSchemas[T]>>
): Promise<z.infer<DomainDbTableSchemas[T]> | undefined> {
  const snakeCaseMapper = getColumnNameMapper(tableName);

  const entries = Object.entries(where) as Array<[string, unknown]>;
  const clause = entries
    .map(([k], i) => `"${snakeCaseMapper(k)}" = $${i + 1}`)
    .join(" AND ");
  const values = entries.map(([, v]) => v);

  const row = await db.conn.oneOrNone(
    `SELECT * FROM ${config.dbSchemaName}.${tableName} WHERE ${clause}`,
    values
  );

  return row ? camelcaseKeys(row) : undefined;
}

export async function getManyFromDb<T extends DomainDbTable>(
  db: DBContext,
  tableName: T,
  where: Partial<z.infer<DomainDbTableSchemas[T]>>
): Promise<Array<z.infer<DomainDbTableSchemas[T]>>> {
  const snakeCaseMapper = getColumnNameMapper(tableName);

  const entries = Object.entries(where) as Array<[string, unknown]>;
  const clause = entries
    .map(([k], i) => `"${snakeCaseMapper(k)}" = $${i + 1}`)
    .join(" AND ");
  const values = entries.map(([, v]) => v);

  const rows = await db.conn.any(
    `SELECT * FROM ${config.dbSchemaName}.${tableName} WHERE ${clause}`,
    values
  );

  return rows.map((row) => camelcaseKeys(row));
}
