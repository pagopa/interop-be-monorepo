import { drizzle } from "drizzle-orm/node-postgres";
import { startServer } from "pagopa-interop-commons";
import pg from "pg";

import { createApp } from "./app.js";
import { config } from "./config/config.js";
import { contactServiceBuilder } from "./services/contactService.js";

const pool = new pg.Pool({
  host: config.contactDataDBHost,
  database: config.contactDataDBName,
  user: config.contactDataDBUsername,
  password: config.contactDataDBPassword,
  port: config.contactDataDBPort,
  ssl: config.contactDataDBUseSSL ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle({ client: pool });
const service = contactServiceBuilder(db);
startServer(await createApp(service), config);
