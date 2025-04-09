import pRetry from "p-retry";
import { AnalyticsSQLDbConfig, DB, Logger } from "pagopa-interop-commons";
import { IMain, ColumnSet, IColumnDescriptor } from "pg-promise";
import { DBContext } from "./db.js";

export type ColumnValue = string | number | Date | undefined | null | boolean;

/**
 * This is a helper function that generates a ColumnSet for bulk operations using pg-promise.
 * It creates a mapping between object properties and corresponding database columns.
 *
 * @param pgp - The pg-promise main instance used to create the ColumnSet.
 * @param mapping - An object that maps column names to functions which extract the corresponding value from a record.
 * @param tableName - The name of the target table for which the ColumnSet is generated.
 * @param schemaName - The name of the target schema for which the ColumnSet is generated.
 * @returns A ColumnSet configured with the specified columns and table details.
 */
export const buildColumnSet = <T>(
  pgp: IMain,
  mapping: Record<string, (record: T) => ColumnValue>,
  tableName: string
): ColumnSet<T> => {
  const columns = Object.entries(mapping).map(([name, initFn]) => ({
    name,
    init: ({ source }: IColumnDescriptor<T>) => initFn(source),
  }));
  return new pgp.helpers.ColumnSet(columns, {
    table: { table: tableName },
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
