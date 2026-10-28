import { drizzle } from "drizzle-orm/node-postgres";
import { startServer } from "pagopa-interop-commons";
import pg from "pg";

import { createApp } from "./app.js";
import { config } from "./config/config.js";

const pool = new pg.Pool({
  host: config.contactDataDBHost,
  database: config.contactDataDBName,
  user: config.contactDataDBUsername,
  password: config.contactDataDBPassword,
  port: config.contactDataDBPort,
  ssl: config.contactDataDBUseSSL ? { rejectUnauthorized: false } : undefined,
});

// The contact service will use this client when its operations are implemented.
drizzle({ client: pool });
startServer(await createApp(), config);
