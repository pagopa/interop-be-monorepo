import { startServer } from "pagopa-interop-commons";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { inAppNotificationServiceBuilder } from "./services/inAppNotificationService.js";

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
const db = drizzle({ client: pool });

const service = inAppNotificationServiceBuilder(db);
startServer(await createApp(service), config);
