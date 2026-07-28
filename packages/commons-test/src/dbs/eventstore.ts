import pgPromise from "pg-promise";

import { createPostgresDatabaseFromTemplate } from "../testcontainers/postgres.js";

export const EVENTSTORE_DB_TEMPLATE_NAME = "eventstore_template";

/**
 * Creates a dedicated database for a single test file by cloning the template.
 * It generates a unique DB name, creates it using TEMPLATE, and returns a
 * pg-promise IDatabase connection (matching the event store's runtime client).
 *
 * Intended to be called in beforeAll of each test file.
 */
export async function setupEventstoreTestDatabase(
  connectionString: string,
  schema: string // one of the schemas defined in event-store-init.sql (e.g. "catalog", "agreement")
) {
  const randomId = crypto.randomUUID();
  const dbName = `test_eventstore_db_worker_${randomId}`;

  await createPostgresDatabaseFromTemplate(
    connectionString,
    EVENTSTORE_DB_TEMPLATE_NAME,
    dbName
  );

  const pgp = pgPromise({ schema });
  return pgp({ connectionString: connectionString + `/${dbName}`, max: 2 });
}
