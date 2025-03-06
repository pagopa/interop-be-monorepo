import { drizzle } from "drizzle-orm/node-postgres";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";
import { Pool } from "pg";

export const makeDrizzleConnection = (
  readModelSQLDbConfig: ReadModelSQLDbConfig
): ReturnType<typeof drizzle> => {
  const pool = new Pool({
    host: readModelSQLDbConfig.readModelSQLDbHost,
    port: readModelSQLDbConfig.readModelSQLDbPort,
    database: readModelSQLDbConfig.readModelSQLDbName,
    user: readModelSQLDbConfig.readModelSQLDbUsername,
    password: readModelSQLDbConfig.readModelSQLDbPassword,
    ssl: readModelSQLDbConfig.readModelSQLDbUseSSL,
  });
  return drizzle({ client: pool });
};
