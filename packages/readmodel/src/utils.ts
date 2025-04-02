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

/**
 * @async
 * @function checkMetadataVersion
 * Check if the object has already been processed by checking the id and metadataVersion in the DB
 * @param {DrizzleTransactionType} tx - The drizzle object to manage db transaction
 * @param {T} table - The table (drizzle object) of the object to upsert
 * @param {number} metadataVersion - The value of the object's metadataVersion to update
 * @param {string} id - The value of the object's id to update
 * @returns {Promise<boolean>} - Returns true if there's no row or no metadataVersion in the DB or if the existing version <= the new version
 * @example
 * const shouldUpsert = await checkMetadataVersion(
 *     tx,
 *     agreementInReadmodelAgreement,
 *     metadataVersion,
 *     agreement.id,
 * );
 *
 */
export const checkMetadataVersion = async (
  tx: DrizzleTransactionType,
  table: AnyPgTable & {
    metadataVersion: AnyPgColumn<{ data: number }>;
    id: AnyPgColumn;
  },
  metadataVersion: number,
  id: string
): Promise<boolean> => {
  const [row] = await tx
    .select({
      metadataVersion: table.metadataVersion,
    })
    .from(table as AnyPgTable)
    .where(eq(table.id, id));

  const existingMetadataVersion = row?.metadataVersion;

  if (existingMetadataVersion == null) {
    return true;
  }
  return existingMetadataVersion <= metadataVersion;
};

/**
 * @async
 * @function checkMetadataVersionByFilter
 * Check if the object has already been processed by checking a filter based on custom column (ex. 'kid' instead of 'id') and metadataVersion in the DB
 * @param {DrizzleTransactionType} tx - The drizzle object to manage db transaction
 * @param {T} table - The table (drizzle object) of the object to upsert
 * @param {number} metadataVersion - The value of the object's metadataVersion to update
 * @param {SQL} filter - The drizzle expression to place in `where` condition,
 * @returns {Promise<boolean>} - Returns true if there's no row or no metadataVersion in the DB or if the existing version <= the new version
 * @example
 * const shouldUpsert = await checkMetadataVersionByFilter(
 *   tx,
 *   clientJwkKeyInReadmodelClientJwkKey,
 *   metadataVersion,
 *   eq(clientJwkKeyInReadmodelClientJwkKey.kid, clientJWKKey.kid)
 * );
 *
 */
export const checkMetadataVersionByFilter = async (
  tx: DrizzleTransactionType,
  table: AnyPgTable & {
    metadataVersion: AnyPgColumn<{ data: number }>;
  },
  metadataVersion: number,
  filter: SQL
): Promise<boolean> => {
  const [row] = await tx
    .select({
      metadataVersion: table.metadataVersion,
    })
    .from(table as AnyPgTable)
    .where(filter);

  const existingMetadataVersion = row?.metadataVersion;

  if (existingMetadataVersion == null) {
    return true;
  }
  return existingMetadataVersion <= metadataVersion;
};
