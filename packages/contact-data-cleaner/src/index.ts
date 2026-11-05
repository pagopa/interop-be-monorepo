import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "pagopa-interop-commons";
import pg from "pg";

import { config } from "./config/config.js";
import { runContactDataCleaner } from "./contactDataCleaner.js";

const loggerInstance = logger({ serviceName: "contact-data-cleaner" });

const pool = new pg.Pool({
  host: config.contactDataDBHost,
  database: config.contactDataDBName,
  user: config.contactDataDBUsername,
  password: config.contactDataDBPassword,
  port: config.contactDataDBPort,
  ssl: config.contactDataDBUseSSL ? { rejectUnauthorized: false } : undefined,
});

try {
  await runContactDataCleaner({
    db: drizzle({ client: pool }),
    logger: loggerInstance,
    now: new Date(),
    pageSize: config.contactScanPageSize,
    protectionPeriodHours: config.contactProtectionPeriodHours,
  });
} catch (error) {
  loggerInstance.error(
    `Contact data cleaner failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
