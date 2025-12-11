import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { logger } from "pagopa-interop-commons";
import {
  selfcareV2InstitutionClientBuilder,
  notificationConfigApi,
} from "pagopa-interop-api-clients";
import { config } from "./config/config.js";
import { processTenantsUsers } from "./processTenantsUsers.js";

const run = async (): Promise<void> => {
  const loggerInstance = logger({
    serviceName: "create-default-user-notification-config",
  });

  loggerInstance.info(
    "Starting create-default-user-notification-config script"
  );

  const pool = new pg.Pool({
    host: config.readModelSQLDbHost,
    database: config.readModelSQLDbName,
    user: config.readModelSQLDbUsername,
    password: config.readModelSQLDbPassword,
    port: config.readModelSQLDbPort,
    ssl: config.readModelSQLDbUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const db = drizzle(pool, {
    schema: {
      tenantSchema: config.readModelSQLDbSchemaTenant,
    },
  });

  const selfcareInstitutionClient = selfcareV2InstitutionClientBuilder({
    selfcareBaseUrl: config.selfcareBaseUrl,
    selfcareApiKey: config.selfcareApiKey,
  });

  const notificationConfigClient = notificationConfigApi.createProcessApiClient(
    config.notificationConfigProcessUrl,
    {
      axiosConfig: {
        headers: {
          Authorization: `Bearer ${config.internalToken}`,
        },
      },
    }
  );

  try {
    await processTenantsUsers(
      db,
      selfcareInstitutionClient,
      notificationConfigClient,
      config,
      loggerInstance
    );
    loggerInstance.info("Script completed successfully");
  } catch (error) {
    loggerInstance.error(
      `Script failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
};

await run();
