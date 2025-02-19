import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.READMODEL_SQL_DB_HOST!,
    port: Number(process.env.READMODEL_SQL_DB_PORT!),
    user: process.env.READMODEL_SQL_DB_USERNAME!,
    password: process.env.READMODEL_SQL_DB_PASSWORD!,
    database: process.env.READMODEL_SQL_DB_NAME!,
    ssl: process.env.READMODEL_SQL_DB_USE_SSL! === "true",
  },
  schemaFilter: process.env.READMODEL_SQL_DB_SCHEMA!,
});
