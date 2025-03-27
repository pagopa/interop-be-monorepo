import { eq, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { AnyPgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
} from "pagopa-interop-readmodel-models";
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
    ssl: readModelSQLDbConfig.readModelSQLDbUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return drizzle({ client: pool });
};

export const makeUniqueKey = (ids: string[]): string => ids.join("#");

export const checkMetadataVersion = async <
  T extends AnyPgTable & {
    metadataVersion: AnyPgColumn<{ data: number }>;
    id: AnyPgColumn;
  }
>(
  tx: DrizzleTransactionType,
  table: T,
  metadataVersion: number,
  id: string,
  filter: SQL<unknown> = eq(table.id, id)
): Promise<boolean> => {
  const existingMetadataVersion = (
    await tx
      .select({
        metadataVersion: table.metadataVersion,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(table as AnyPgTable)
      .where(filter)
  )[0]?.metadataVersion;

  return !existingMetadataVersion || existingMetadataVersion <= metadataVersion;
};
