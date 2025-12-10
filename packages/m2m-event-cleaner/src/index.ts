import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { deleteOldM2MEvents } from "./deleteOldM2MEvents.js";

const run = async (): Promise<void> => {
  const loggerInstance = logger({
    serviceName: "m2m-event-cleaner",
  });

  loggerInstance.info(
    `Starting m2m event cleaner. Deleting events older than ${config.deleteOlderThanDays} days.`
  );

  const pool = new pg.Pool({
    host: config.m2mEventSQLDbHost,
    database: config.m2mEventSQLDbName,
    user: config.m2mEventSQLDbUsername,
    password: config.m2mEventSQLDbPassword,
    port: config.m2mEventSQLDbPort,
    ssl: config.m2mEventSQLDbUseSSL ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  try {
    await deleteOldM2MEvents(db, config.deleteOlderThanDays, loggerInstance);
  } catch (error) {
    loggerInstance.error(
      `Error deleting events: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
};

await run();
