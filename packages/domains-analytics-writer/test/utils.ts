import { initDB, DBContext, DBConnection } from "../src/db/db.js";
import { config } from "../src/config/config.js";

const dbInstance = initDB({
  username: config.dbUsername,
  password: config.dbPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  useSSL: config.dbUseSSL,
  maxConnectionPool: config.dbMaxConnectionPool,
});

const connection = await dbInstance.connect();
export const dbContext: DBContext = {
  conn: connection,
  pgp: dbInstance.$config.pgp,
};

export async function getTargetTableCount(
  db: DBConnection,
  table: string,
): Promise<number> {
  const query = `SELECT COUNT(*) as count FROM $1:name.$2:name;`;
  const result = await db.one<{ count: string }>(query, [
    config.dbSchemaName,
    [table],
  ]);
  return Number(result.count);
}

export async function truncateTables(
  db: DBConnection,
  schema: string,
  tables: string[],
): Promise<void> {
  for (const table of tables) {
    await db.none(`TRUNCATE TABLE ${schema}.${table};`);
  }
}

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
