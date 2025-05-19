import pRetry from "p-retry";
import { AnalyticsSQLDbConfig, DB, Logger } from "pagopa-interop-commons";
import { DBContext } from "./db.js";

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
