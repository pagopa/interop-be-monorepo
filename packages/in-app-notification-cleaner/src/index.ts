import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { lt } from "drizzle-orm";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import { logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";

const run = async (): Promise<void> => {
  const loggerInstance = logger({
    serviceName: "in-app-notification-cleaner",
  });

  loggerInstance.info(
    `Starting in-app notification cleaner. Deleting notifications older than ${config.DELETE_OLDER_THAN_DAYS} days.`
  );

  const pool = new pg.Pool({
    host: config.inAppNotificationDBHost,
    database: config.inAppNotificationDBName,
    user: config.inAppNotificationDBUsername,
    password: config.inAppNotificationDBPassword,
    port: config.inAppNotificationDBPort,
    ssl: config.inAppNotificationDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const db = drizzle(pool);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.DELETE_OLDER_THAN_DAYS);

  try {
    const result = await db
      .delete(notification)
      .where(lt(notification.createdAt, cutoffDate.toISOString()));

    loggerInstance.info(
      `Successfully deleted ${
        result.rowCount
      } notifications older than ${cutoffDate.toISOString()}`
    );
  } catch (error) {
    loggerInstance.error(
      `Error deleting notifications: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
};

await run();
