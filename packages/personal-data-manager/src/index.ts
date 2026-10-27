import { drizzle } from "drizzle-orm/node-postgres";
import { startServer } from "pagopa-interop-commons";
import pg from "pg";

import { createApp } from "./app.js";
import { config } from "./config/config.js";

const pool = new pg.Pool({
  host: config.personalDataDBHost,
  database: config.personalDataDBName,
  user: config.personalDataDBUsername,
  password: config.personalDataDBPassword,
  port: config.personalDataDBPort,
  ssl: config.personalDataDBUseSSL ? { rejectUnauthorized: false } : undefined,
});

// The contact service will use this client when its operations are implemented.
drizzle({ client: pool });
startServer(await createApp(), config);
