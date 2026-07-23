import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { createPostgresDatabaseFromTemplate } from "../testcontainers/postgres.js";

export const READMODEL_DB_TEMPLATE_NAME = "readmodel_template";

/**
 * Creates a dedicated database for a single test file by cloning the template.
 * It generates a unique DB name, creates it using TEMPLATE, and returns a Drizzle connection.
 *
 * Intended to be called in beforeAll of each test file.
 */
export async function setupReadmodelTestDatabase(connectionString: string) {
  const randomId = crypto.randomUUID();
  const dbName = `test_readmodel_db_worker_${randomId}`;

  await createPostgresDatabaseFromTemplate(
    connectionString,
    READMODEL_DB_TEMPLATE_NAME,
    dbName
  );

  return drizzle(
    new pg.Pool({ connectionString: connectionString + `/${dbName}`, max: 2 })
  );
}
