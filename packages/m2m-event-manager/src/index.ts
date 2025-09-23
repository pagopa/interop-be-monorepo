import { startServer } from "pagopa-interop-commons";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "./config/config.js";
import { createApp } from "./app.js";
import { m2mEventServiceBuilder } from "./services/m2mEventService.js";
import { m2mEventReaderServiceSQLBuilder } from "./services/m2mEventReaderServiceSQL.js";

const pool = new pg.Pool({
  host: config.m2mEventSQLDbHost,
  database: config.m2mEventSQLDbName,
  user: config.m2mEventSQLDbUsername,
  password: config.m2mEventSQLDbPassword,
  port: config.m2mEventSQLDbPort,
  ssl: config.m2mEventSQLDbUseSSL ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle({ client: pool });

const reader = m2mEventReaderServiceSQLBuilder(db);
const service = m2mEventServiceBuilder(reader);

startServer(await createApp(service), config);
