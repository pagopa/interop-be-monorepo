import type {} from "vitest";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type StartedNetwork } from "testcontainers";

const TEST_POSTGRES_DB_PORT = 5432;
const TEST_POSTGRES_IMAGE = "postgres:17.7";
const DB_USER = "root";
const DB_PASSWORD = "root";

export async function createPostgresDatabaseFromTemplate(
  connectionString: string,
  templateName: string,
  dbName: string
) {
  await withAdminDb(connectionString, async (adminDb) => {
    await adminDb.execute(
      `CREATE DATABASE "${dbName}" TEMPLATE "${templateName}"`
    );
  });
}

export async function setupPostgresTemplate({
  connectionString,
  sqlDir,
  template,
}: {
  connectionString: string;
  sqlDir: string;
  template: string;
}) {
  let templateExists = false;

  await withAdminDb(connectionString, async (adminDb) => {
    const result = await adminDb.execute(
      `SELECT 1 FROM pg_database WHERE datname = '${template}'`
    );
    templateExists = Array.isArray(result.rows) && result.rows.length > 0;

    if (!templateExists) {
      await adminDb.execute(`CREATE DATABASE "${template}"`);
    }
  });

  if (!templateExists) {
    const files = readdirSync(sqlDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const db = drizzle(connectionString + `/${template}`);
    try {
      for (const file of files) {
        const sql = readFileSync(join(sqlDir, file), "utf-8");
        await db.execute(sql);
      }
    } finally {
      await db.$client.end();
    }

    await withAdminDb(connectionString, async (adminDb) => {
      await adminDb.execute(`ALTER DATABASE "${template}" IS_TEMPLATE true`);
    });
  }
}

export async function setupPostgresTestContainer(network: StartedNetwork) {
  const container = await new PostgreSqlContainer(TEST_POSTGRES_IMAGE)
    .withNetwork(network)
    .withNetworkAliases("postgres")
    .withName("pagopa-interop-postgres-test-container")
    .withLabels({ "com.docker.compose.project": "pagopa-interop-test" })
    .withReuse()
    .withPassword(DB_PASSWORD)
    .withUsername(DB_USER)
    .withCommand(["postgres", "-c", "max_connections=500"])
    .start();

  const port = container.getMappedPort(TEST_POSTGRES_DB_PORT);
  const host = container.getHost();
  const connectionString = `postgresql://${DB_USER}:${DB_PASSWORD}@${host}:${port}`;

  return { connectionString, container };
}

async function withAdminDb(
  connectionString: string,
  callback: (db: NodePgDatabase) => Promise<void>
) {
  const adminDb = drizzle(connectionString + `/postgres`);

  try {
    return await callback(adminDb);
  } finally {
    await adminDb.$client.end();
  }
}

declare module "vitest" {
  export interface ProvidedContext {
    POSTGRES_CONNECTION_STRING: string;
  }
}
