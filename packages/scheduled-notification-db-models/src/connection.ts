import { drizzle } from "drizzle-orm/node-postgres";
import { ScheduledNotificationDBConfig } from "pagopa-interop-commons";
import pg from "pg";

import { ScheduledNotificationDrizzleReturnType } from "./types.js";

export const makeScheduledNotificationDrizzleConnection = (
  config: ScheduledNotificationDBConfig
): ScheduledNotificationDrizzleReturnType => {
  const pool = new pg.Pool({
    host: config.scheduledNotificationDBHost,
    port: config.scheduledNotificationDBPort,
    database: config.scheduledNotificationDBName,
    user: config.scheduledNotificationDBUsername,
    password: config.scheduledNotificationDBPassword,
    ssl: config.scheduledNotificationDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return drizzle({ client: pool });
};
