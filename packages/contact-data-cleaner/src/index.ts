import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "pagopa-interop-commons";
import pg from "pg";

import { config } from "./config/config.js";
import { runContactDataCleaner } from "./contactDataCleaner.js";
import { unavailableContactReferenceChecker } from "./contactReferenceChecker.js";
import { describeError } from "./utilities/errors.js";

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
  const { failedContacts } = await runContactDataCleaner({
    db: drizzle({ client: pool }),
    deletionEnabled: config.contactDeletionEnabled,
    logger: loggerInstance,
    now: new Date(),
    pageSize: config.contactScanPageSize,
    protectionPeriodHours: config.contactProtectionPeriodHours,
    referenceChecker: unavailableContactReferenceChecker,
  });
  // Failed contacts are retried by the next run; report this run as failed.
  if (failedContacts > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  loggerInstance.error(`Contact data cleaner failed: ${describeError(error)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
