import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "pagopa-interop-commons";
import pg from "pg";

import { config } from "./config/config.js";
import { deleteOldNotifications } from "./deleteOldNotifications.js";

const run = async (): Promise<void> => {
  const loggerInstance = logger({
    serviceName: "scheduled-notification-cleaner",
  });

  loggerInstance.info(
    `Starting scheduled notification cleaner. Deleting notifications older than ${config.DELETE_OLDER_THAN_DAYS} days.`
  );

  const pool = new pg.Pool({
    host: config.scheduledNotificationDBHost,
    database: config.scheduledNotificationDBName,
    user: config.scheduledNotificationDBUsername,
    password: config.scheduledNotificationDBPassword,
    port: config.scheduledNotificationDBPort,
    ssl: config.scheduledNotificationDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const db = drizzle(pool);

  const endPoolOnExit = async (code: number) => {
    await pool.end();
    process.exit(code);
  };

  try {
    await deleteOldNotifications(
      db,
      config.DELETE_OLDER_THAN_DAYS,
      loggerInstance
    );
    await endPoolOnExit(0);
  } catch (error) {
    loggerInstance.error(
      `Error deleting notifications: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    await endPoolOnExit(1);
  }
};

await run();
