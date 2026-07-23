import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type TestDrizzleDb = NodePgDatabase<Record<string, never>> & {
  $client: Pool;
};
