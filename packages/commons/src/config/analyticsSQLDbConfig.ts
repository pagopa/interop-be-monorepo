import { z } from "zod";

export const AnalyticsSQLDbConfig = z
  .object({
    ANALYTICS_SQL_DB_HOST: z.string(),
    ANALYTICS_SQL_DB_NAME: z.string(),
    ANALYTICS_SQL_DB_USERNAME: z.string(),
    ANALYTICS_SQL_DB_PASSWORD: z.string(),
    ANALYTICS_SQL_DB_PORT: z.coerce.number().min(1001),
    ANALYTICS_SQL_DB_SCHEMA_NAME: z.string(),
    ANALYTICS_SQL_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    ANALYTICS_SQL_DB_MAX_CONNECTION_POOL: z.coerce.number().default(10),
    ANALYTICS_SQL_DB_CONNECTION_RETRIES: z.coerce.number().default(10),
    ANALYTICS_SQL_DB_CONNECTION_MIN_TIMEOUT: z.coerce.number().default(5000),
    ANALYTICS_SQL_DB_CONNECTION_MAX_TIMEOUT: z.coerce.number().default(10000),
  })
  .transform((c) => ({
    dbHost: c.ANALYTICS_SQL_DB_HOST,
    dbName: c.ANALYTICS_SQL_DB_NAME,
    dbUsername: c.ANALYTICS_SQL_DB_USERNAME,
    dbPassword: c.ANALYTICS_SQL_DB_PASSWORD,
    dbPort: c.ANALYTICS_SQL_DB_PORT,
    dbSchemaName: c.ANALYTICS_SQL_DB_SCHEMA_NAME,
    dbUseSSL: c.ANALYTICS_SQL_DB_USE_SSL,
    dbMaxConnectionPool: c.ANALYTICS_SQL_DB_MAX_CONNECTION_POOL,
    dbConnectionRetries: c.ANALYTICS_SQL_DB_CONNECTION_RETRIES,
    dbConnectionMinTimeout: c.ANALYTICS_SQL_DB_CONNECTION_MIN_TIMEOUT,
    dbConnectionMaxTimeout: c.ANALYTICS_SQL_DB_CONNECTION_MAX_TIMEOUT,
  }));

export type AnalyticsSQLDbConfig = z.infer<typeof AnalyticsSQLDbConfig>;
