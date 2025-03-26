import { drizzle } from "drizzle-orm/node-postgres";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";
import pg from "pg";

export const makeDrizzleConnection = (
  readModelSQLDbConfig: ReadModelSQLDbConfig
): DrizzleReturnType => {
  const pool = new pg.Pool({
    host: readModelSQLDbConfig.readModelSQLDbHost,
    port: readModelSQLDbConfig.readModelSQLDbPort,
    database: readModelSQLDbConfig.readModelSQLDbName,
    user: readModelSQLDbConfig.readModelSQLDbUsername,
    password: readModelSQLDbConfig.readModelSQLDbPassword,
    ssl: readModelSQLDbConfig.readModelSQLDbUseSSL,
  });
  return drizzle({ client: pool });
};

export const makeUniqueKey = (ids: string[]): string => ids.join("#");
