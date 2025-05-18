import pRetry from "p-retry";
import { AnalyticsSQLDbConfig, DB, Logger } from "pagopa-interop-commons";
import { IMain, ColumnSet, IColumnDescriptor } from "pg-promise";
import { z } from "zod";
import { getColumnName } from "../utils/sqlQueryHelper.js";
import { DbTable } from "../model/db/index.js";
import { config } from "../config/config.js";
import { DBContext } from "./db.js";

export type ColumnValue = string | number | Date | undefined | null | boolean;

/**
 * Builds a pg-promise ColumnSet for performing bulk insert/update operations on a given table.
 *
 * This function maps the fields of a Zod schema to database columns using a snake_case naming strategy,
 * which allows pg-promise to efficiently generate SQL for bulk operations.
 *
 * @template T - The Zod object schema shape describing the table structure.
 * @param pgp - The pg-promise main instance used to create the ColumnSet.
 * @param tableName - The logical name of the database table (without suffixes).
 * @param schema - The Zod schema representing the shape of the data to persist.
 * @returns A pg-promise ColumnSet object with mapped columns for bulk operations.
 */
export const buildColumnSet = <T extends z.ZodRawShape>(
  pgp: IMain,
  tableName: DbTable,
  schema: z.ZodObject<T>
): ColumnSet<z.infer<typeof schema>> => {
  const snakeCase = getColumnName(tableName);
  const keys = Object.keys(schema.shape) as Array<keyof z.infer<typeof schema>>;

  const columns = keys.map((prop) => ({
    name: snakeCase(String(prop)),
    init: ({ source }: IColumnDescriptor<z.infer<typeof schema>>) =>
      source[prop],
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
