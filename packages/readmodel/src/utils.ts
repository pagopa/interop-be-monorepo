import { drizzle } from "drizzle-orm/node-postgres";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";
import { Pool } from "pg";

export const makeDrizzleConnection = (
  readModelSQLDbConfig: ReadModelSQLDbConfig
): DrizzleReturnType => {
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
