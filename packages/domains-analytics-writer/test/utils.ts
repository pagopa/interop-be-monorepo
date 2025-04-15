/* eslint-disable @typescript-eslint/no-explicit-any */

import { genericLogger } from "pagopa-interop-commons";
import { inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Batch } from "kafkajs";
import { AttributeSchema } from "../src/model/attribute/attribute.js";
import { DBContext, DBConnection } from "../src/db/db.js";
import { config } from "../src/config/config.js";
import { retryConnection } from "../src/db/buildColumnSet.js";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import {
  AttributeDbtable,
  CatalogDbTable,
  DeletingDbTable,
} from "../src/model/db.js";
import { attributeServiceBuilder } from "../src/service/attributeService.js";

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

await retryConnection(
  analyticsPostgresDB,
  dbContext,
  config,
  async (db) => {
    await setupDbServiceBuilder(db.conn, config).setupStagingTables([
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
    ]);
    await setupDbServiceBuilder(db.conn, config).setupStagingDeletingByIdTables(
      [
        DeletingDbTable.catalog_deleting_table,
        DeletingDbTable.attribute_deleting_table,
      ],
    );
  },
  genericLogger,
);

export const attributeService = attributeServiceBuilder(dbContext);

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

export async function getAttributeFromDb(
  id: string,
  db: DBContext,
): Promise<AttributeSchema[] | null> {
  return db.conn.any(`SELECT * FROM domains.attribute WHERE id = $1`, [id]);
}

export const mockAttributeBatch: Batch = {
  topic: config.attributeTopic,
  partition: 0,
  highWatermark: "0",
  messages: [
    {
      value: { event_version: 1 },
    } as any,
  ],
  isEmpty: () => false,
  firstOffset: () => "0",
  lastOffset: () => "0",
  offsetLag: () => "0",
  offsetLagLow: () => "0",
};
export const mockCatalogBatch: Batch = {
  topic: config.catalogTopic,
  partition: 0,
  highWatermark: "0",
  messages: [
    {
      value: { event_version: 1 },
    } as any,
    {
      value: { event_version: 2 },
    } as any,
  ],
  isEmpty: () => false,
  firstOffset: () => "0",
  lastOffset: () => "0",
  offsetLag: () => "0",
  offsetLagLow: () => "0",
};

export async function getEserviceFromDb(
  serviceId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.one(`SELECT * FROM domains.eservice WHERE id = $1`, [
    serviceId,
  ]);
}

export async function getDescriptorFromDb(
  descriptorId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor WHERE id = $1`,
    [descriptorId],
  );
}

export async function getDocumentFromDb(
  documentId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_document WHERE id = $1`,
    [documentId],
  );
}

export async function getInterfaceFromDb(
  interfaceId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_descriptor_interface WHERE id = $1`,
    [interfaceId],
  );
}

export async function getRiskAnalysisFromDb(
  riskAnalysisId: string,
  db: DBContext,
): Promise<any> {
  return db.conn.any(
    `SELECT * FROM domains.eservice_risk_analysis WHERE id = $1`,
    [riskAnalysisId],
  );
}
