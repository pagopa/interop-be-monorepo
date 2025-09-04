import "dotenv/config";
import { defineConfig } from "drizzle-kit";
// import { M2MEventSQLDbConfig } from "pagopa-interop-commons";

// const m2mEventDBConfig = M2MEventSQLDbConfig.parse(process.env);

// TODO use config from env vars
export default defineConfig({
  out: "./src/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: "localhost",
    port: 6006,
    user: "root",
    password: "root",
    database: "root",
    ssl: false,
  },
  schemaFilter: ["m2m_event"],
});
