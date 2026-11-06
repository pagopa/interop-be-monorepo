import { defineConfig } from "drizzle-kit";
import { InAppNotificationDBConfig } from "pagopa-interop-commons";

export const config = InAppNotificationDBConfig.parse(process.env);

export default defineConfig({
  out: "./src/generated",
  dialect: "postgresql",
  dbCredentials: {
    host: config.inAppNotificationDBHost,
    port: config.inAppNotificationDBPort,
    user: config.inAppNotificationDBUsername,
    password: config.inAppNotificationDBPassword,
    database: config.inAppNotificationDBName,
    ssl: config.inAppNotificationDBUseSSL,
  },
  schemaFilter: [config.inAppNotificationDBSchema],
});
