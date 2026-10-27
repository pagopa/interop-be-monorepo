import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { config } from "./config/config.js";

const pool = new pg.Pool({
  host: config.personalDataDBHost,
  database: config.personalDataDBName,
  user: config.personalDataDBUsername,
  password: config.personalDataDBPassword,
  port: config.personalDataDBPort,
  ssl: config.personalDataDBUseSSL ? { rejectUnauthorized: false } : undefined,
});

export const personalDataDb = drizzle({ client: pool });
