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
import { agreementServiceBuilder } from "../src/service/agreementService.js";
import { attributeServiceBuilder } from "../src/service/attributeService.js";
import { getColumnName } from "../src/utils/sqlQueryHelper.js";

export const { cleanup, analyticsPostgresDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("analyticsSQLDbConfig"),
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

export const deletingTables: DeletingDbTable[] = [
  DeletingDbTable.attribute_deleting_table,
  DeletingDbTable.catalog_deleting_table,
  DeletingDbTable.catalog_risk_deleting_table,
];

export const domainTables: DomainDbTable[] = [
  ...attributeTables,
  ...catalogTables,
];

export const setupStagingDeletingTables: DeletingDbTableConfigMap[] = [
  { name: DeletingDbTable.attribute_deleting_table, columns: ["id"] },
  { name: DeletingDbTable.catalog_deleting_table, columns: ["id"] },
  {
    name: DeletingDbTable.catalog_risk_deleting_table,
    columns: ["id", "eserviceId"],
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
  genericLogger,
);

export async function resetTargetTables(
  tables: DomainDbTable[],
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
  where: Partial<z.infer<DomainDbTableSchemas[T]>>,
): Promise<z.infer<DomainDbTableSchemas[T]>> {
  const snakeCase = getColumnName(tableName);

  const entries = Object.entries(where) as Array<[string, unknown]>;
  const clause = entries
    .map(([k], i) => `"${snakeCase(k)}" = $${i + 1}`)
    .join(" AND ");
  const values = entries.map(([, v]) => v);

  const row = await db.conn.one(
    `SELECT * FROM ${config.dbSchemaName}.${tableName} WHERE ${clause}`,
    values,
  );

  return camelcaseKeys(row);
}

export async function getManyFromDb<T extends DomainDbTable>(
  db: DBContext,
  tableName: T,
  where: Partial<z.infer<DomainDbTableSchemas[T]>>,
): Promise<Array<z.infer<DomainDbTableSchemas[T]>>> {
  const snakeCase = getColumnName(tableName);

  const entries = Object.entries(where) as Array<[string, unknown]>;
  const clause = entries
    .map(([k], i) => `"${snakeCase(k)}" = $${i + 1}`)
    .join(" AND ");
  const values = entries.map(([, v]) => v);

  const rows = await db.conn.any(
    `SELECT * FROM ${config.dbSchemaName}.${tableName} WHERE ${clause}`,
    values,
  );

  return rows.map((row) => camelcaseKeys(row));
}

export const agreementService = agreementServiceBuilder(dbContext);

export async function getAgreementFromDb(id: string, db: DBContext) {
  return db.conn.one(`SELECT * FROM domains.agreement WHERE id = $1`, [id]);
}
export async function getAgreementStampFromDb(agrId: string, db: DBContext) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_stamp WHERE agreement_id = $1`,
    [agrId],
  );
}
export async function getAgreementAttributeFromDb(
  attrId: string,
  db: DBContext,
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_attribute WHERE attribute_id = $1`,
    [attrId],
  );
}
export async function getAgreementConsumerDocumentFromDb(
  docId: string,
  db: DBContext,
) {
  return db.conn.any(
    `SELECT * FROM domains.agreement_consumer_document WHERE id = $1`,
    [docId],
  );
}
export async function getAgreementContractFromDb(
  contractId: string,
  db: DBContext,
) {
  return db.conn.any(`SELECT * FROM domains.agreement_contract WHERE id = $1`, [
    contractId,
  ]);
}

export async function resetAgreementTables(db: DBContext): Promise<void> {
  const tbls = [
    AgreementDbTable.agreement,
    AgreementDbTable.agreement_stamp,
    AgreementDbTable.agreement_attribute,
    AgreementDbTable.agreement_consumer_document,
    AgreementDbTable.agreement_contract,
  ];
  await db.conn.none(`TRUNCATE TABLE ${tbls.join(",")} CASCADE;`);
}

export const agreementId = generateId();
export const docId = generateId();
export const contractId = generateId();

export const agreementSQL = {
  id: unsafeBrandId<AgreementId>(agreementId),
  metadataVersion: 1,
  eserviceId: generateId(),
  descriptorId: generateId(),
  producerId: generateId(),
  consumerId: generateId(),
  state: "ACTIVE",
  suspendedByConsumer: null,
  suspendedByProducer: null,
  suspendedByPlatform: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
  consumerNotes: null,
  rejectionReason: null,
  suspendedAt: null,
};

export const stampSQL = {
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  who: generateId(),
  delegationId: null,
  when: new Date().toISOString(),
  kind: "Producer",
};

export const attributeSQL = {
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  attributeId: generateId(),
  kind: "verified",
};

export const consumerDocSQL = {
  id: unsafeBrandId<AgreementDocumentId>(docId),
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  name: "sampledoc.pdf",
  prettyName: "sampledoc.pdf",
  contentType: "application/pdf",
  path: "/docs/sample.pdf",
  createdAt: new Date().toISOString(),
};

export const contractDocSQL = {
  id: unsafeBrandId<AgreementDocumentId>(contractId),
  agreementId: agreementSQL.id,
  metadataVersion: 1,
  name: "contract.pdf",
  prettyName: "contract.pdf",
  contentType: "application/pdf",
  path: "/docs/contract.pdf",
  createdAt: new Date().toISOString(),
};

export const agreementItem: AgreementItemsSQL = {
  agreementSQL,
  stampsSQL: [stampSQL],
  attributesSQL: [attributeSQL],
  consumerDocumentsSQL: [consumerDocSQL],
  contractSQL: contractDocSQL,
};

export function getMockAgreement(
  overrides: Partial<Agreement> = {},
): Agreement & { metadataVersion: number } {
  const agreementId = unsafeBrandId<AgreementId>(generateId());
  const contractId = unsafeBrandId<AgreementDocumentId>(generateId());
  return {
    id: agreementId,
    metadataVersion: 1,
    eserviceId: generateId(),
    descriptorId: generateId(),
    producerId: generateId(),
    consumerId: generateId(),
    state: "Active",
    suspendedByConsumer: false,
    suspendedByProducer: false,
    suspendedByPlatform: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    consumerNotes: "consumer notes",
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    contract: {
      id: unsafeBrandId<AgreementDocumentId>(contractId),
      name: "contract.pdf",
      prettyName: "contract.pdf",
      contentType: "application/pdf",
      path: "/docs/contract.pdf",
      createdAt: new Date(),
    },
    stamps: {},
    ...overrides,
  };
}

export function agreementItemFromDomain(
  agr: Agreement & { metadataVersion: number },
): AgreementItemsSQL {
  return splitAgreementIntoObjectsSQL(agr, agr.metadataVersion);
}
