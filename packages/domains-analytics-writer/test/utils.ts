/* eslint-disable @typescript-eslint/no-explicit-any */

import { genericLogger } from "pagopa-interop-commons";
import { inject } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { AttributeSchema } from "../src/model/attribute/attribute.js";
import { DBContext, DBConnection } from "../src/db/db.js";
import { config } from "../src/config/config.js";
import { retryConnection } from "../src/db/buildColumnSet.js";
import { setupDbServiceBuilder } from "../src/service/setupDbService.js";
import { AttributeDbtable } from "../src/model/db.js";
import { attributeServiceBuilder } from "../src/service/attributeService.js";

export const { cleanup, analyticsPostgresDb } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("analyticsSQLDbConfig")
);
const connection = await analyticsPostgresDb.connect();

export const dbContext: DBContext = {
  conn: connection,
  pgp: analyticsPostgresDb.$config.pgp as any,
};

await retryConnection(
  analyticsPostgresDb as any,
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
  genericLogger
);

export const attributeService = attributeServiceBuilder(dbContext);

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

export async function getAttributeFromDb(
  id: string,
  db: DBContext
): Promise<AttributeSchema[] | null> {
  return db.conn.any(`SELECT * FROM domains.attribute WHERE id = $1`, [id]);
}

export const multipleTopicMessage = [
  {
    topic: config.attributeTopic,
    message: {
      value: { event_version: 1 },
    },
  },
  {
    topic: config.agreementTopic,
    message: {
      value: { event_version: 1 },
    },
  },
  {
    topic: config.agreementTopic,
    message: {
      value: { event_version: 2 },
    },
  },
  {
    topic: config.catalogTopic,
    message: {
      value: { event_version: 2 },
    },
  },
] as any;

export const singleTopicMessage = [
  {
    topic: config.attributeTopic,
    message: {
      value: { event_version: 1 },
    },
  },
] as any;
