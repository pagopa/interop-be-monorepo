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
  DeletingDbTable,
  DeletingDbTableConfigMap,
  DomainDbTable,
  DomainDbTableSchemas,
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
  undefined,
  inject("analyticsSQLDbConfig")
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
];

export const deletingTables: DeletingDbTable[] = [
  DeletingDbTable.attribute_deleting_table,
  DeletingDbTable.catalog_deleting_table,
  DeletingDbTable.catalog_risk_deleting_table,
  DeletingDbTable.agreement_deleting_table,
];

export const domainTables: DomainDbTable[] = [
  ...attributeTables,
  ...catalogTables,
  ...agreementTables,
];

export const setupStagingDeletingTables: DeletingDbTableConfigMap[] = [
  { name: DeletingDbTable.attribute_deleting_table, columns: ["id"] },
  { name: DeletingDbTable.catalog_deleting_table, columns: ["id"] },
  {
    name: DeletingDbTable.catalog_risk_deleting_table,
    columns: ["id", "eserviceId"],
  },
  {
    name: DeletingDbTable.agreement_deleting_table,
    columns: ["id"],
  },
];

await retryConnection(
  analyticsPostgresDB,
  dbContext,
  config,
  async (db) => {
    const setupDbService = setupDbServiceBuilder(db.conn, config);
    await setupDbService.setupStagingTables(domainTables);
    await setupDbService.setupStagingDeletingTables(setupStagingDeletingTables);
  },
  genericLogger
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
  tables: string[]
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
): Promise<z.infer<DomainDbTableSchemas[T]>> {
  const snakeCaseMapper = getColumnNameMapper(tableName);

  const entries = Object.entries(where) as Array<[string, unknown]>;
  const clause = entries
    .map(([k], i) => `"${snakeCaseMapper(k)}" = $${i + 1}`)
    .join(" AND ");
  const values = entries.map(([, v]) => v);

  const row = await db.conn.one(
    `SELECT * FROM ${config.dbSchemaName}.${tableName} WHERE ${clause}`,
    values
  );

  return camelcaseKeys(row);
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
