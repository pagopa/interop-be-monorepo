import { defineConfig } from "drizzle-kit";
import { M2MEventSQLDbConfig } from "pagopa-interop-commons";

export const config = M2MEventSQLDbConfig.parse(process.env);

export default defineConfig({
  out: "./src/generated",
  dialect: "postgresql",
  dbCredentials: {
    host: config.m2mEventSQLDbHost,
    port: config.m2mEventSQLDbPort,
    user: config.m2mEventSQLDbUsername,
    password: config.m2mEventSQLDbPassword,
    database: config.m2mEventSQLDbName,
    ssl: config.m2mEventSQLDbUseSSL,
  },
  schemaFilter: [config.m2mEventSQLDbSchema],
});
