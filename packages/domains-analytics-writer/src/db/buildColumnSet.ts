import pRetry from "p-retry";
import { AnalyticsSQLDbConfig, DB, Logger } from "pagopa-interop-commons";
import { IMain, ColumnSet, IColumnDescriptor } from "pg-promise";
import { z } from "zod";
import { InferSelectModel } from "drizzle-orm";
import { getColumnName } from "../utils/sqlQueryHelper.js";
import { DbTable, DbTableReadModels, DbTableSchemas } from "../model/db.js";
import { config } from "../config/config.js";
import { DBContext } from "./db.js";

export type ColumnValue = string | number | Date | undefined | null | boolean;

type InputSchema<T extends DbTable> = InferSelectModel<
  (typeof DbTableReadModels)[T]
>;
type OutputSchema<T extends DbTable> = z.infer<DbTableSchemas[T]>;

/**
 * Describes the mapping between the input row (from Drizzle) and
 * the output row (conforming to the Zod schema) for a given table.
 * Each key maps to a function that extracts/transforms the corresponding value.
 */
export type Mapping<T extends DbTable> = {
  [K in keyof OutputSchema<T>]: (record: InputSchema<T>) => OutputSchema<T>[K];
};

/**
 * This is a helper function that generates a ColumnSet for bulk operations using pg-promise.
 * It creates a mapping between object properties and corresponding database columns.
 *
 * @param pgp - The pg-promise main instance used to create the ColumnSet.
 * @param mapping - An object that maps column names to functions which extract the corresponding value from a record.
 * @param tableName - The name of the target table for which the ColumnSet is generated.
 * @returns A ColumnSet configured with the specified columns and table details.
 */
export const buildColumnSet = <T extends DbTable>(
  pgp: IMain,
  tableName: T,
  mapping?: Partial<Mapping<T>>
): ColumnSet<OutputSchema<T>> => {
  const snakeCase = getColumnName(tableName);
  const schema = DbTable[tableName];
  // eslint-disable-next-line no-underscore-dangle
  const keys = Object.keys(schema._def.shape()) as Array<keyof OutputSchema<T>>;

  const columns = keys.map((prop) => ({
    name: snakeCase(prop as string),
    init: ({ source }: IColumnDescriptor<InputSchema<T>>) =>
      mapping?.[prop]?.(source) ?? source[prop as keyof InputSchema<T>],
  }));

  return new pgp.helpers.ColumnSet(columns, {
    table: { table: `${tableName}_${config.mergeTableSuffix}` },
  });
};

/**
 * Attaches an error handler to the current database connection's client.
 *
 * The error handler listens for connection errors and, when triggered,
 * attempts to re-establish the connection using a retry mechanism.
 * Upon successful reconnection, it recursively attaches the error handler
 * to the new connection and executes the provided setup function.
 *
 * @param dbInstance - The database instance used to establish a connection.
 * @param dbContext - The context containing the current database connection and pg-promise instance.
 * @param dbConfig - DB Configuration.
 * @param runFn - The setup function to be executed once a connection is (re)established.
 * @param logger - Logger instance.
 * @returns {void}
 */
const attachErrorHandler = (
  dbInstance: DB,
  dbContext: DBContext,
  dbConfig: AnalyticsSQLDbConfig,
  runFn: (context: DBContext) => Promise<void>,
  logger: Logger
): void => {
  dbContext.conn.client.once("error", async (error: Error) => {
    logger.warn(`Connection failed: ${error.message}. Attempting reconnect...`);

    await pRetry(
      async () => {
        // eslint-disable-next-line functional/immutable-data
        dbContext.conn = await dbInstance.connect();
        attachErrorHandler(dbInstance, dbContext, dbConfig, runFn, logger);
        await runFn(dbContext);
      },
      {
        retries: dbConfig.dbConnectionRetries,
        minTimeout: dbConfig.dbConnectionMinTimeout,
        maxTimeout: dbConfig.dbConnectionMaxTimeout,
        onFailedAttempt: (error) => {
          logger.warn(
            `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left. Error: ${error}. Connection PID: ${dbContext.conn?.client?.processID}`
          );
        },
      }
    );
  });
};

/**
 * This function attaches an error handler to the connection's client that will retry
 * the connection when an error occurs, and then executes the provided function.
 *
 * @param dbInstance - The database instance used to establish connections.
 * @param dbContext - The context containing the current database connection and pg-promise instance.
 * @param dbConfig - DB Configuration.
 * @param runFn - The function to execute on a successfully established connection.
 * @param logger - Logger instance.
 * @returns A promise that resolves when the provided function executes successfully on the connection.
 */
export const retryConnection = async (
  dbInstance: DB,
  dbContext: DBContext,
  dbConfig: AnalyticsSQLDbConfig,
  runFn: (context: DBContext) => Promise<void>,
  logger: Logger
): Promise<void> => {
  attachErrorHandler(dbInstance, dbContext, dbConfig, runFn, logger);
  await runFn(dbContext);
};
