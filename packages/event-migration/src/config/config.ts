import { z } from "zod";

const EventMigrationConfig = z
  .object({
    SOURCE_DB_USERNAME: z.string(),
    SOURCE_DB_PASSWORD: z.string(),
    SOURCE_DB_HOST: z.string(),
    SOURCE_DB_PORT: z.coerce.number(),
    SOURCE_DB_NAME: z.string(),
    SOURCE_DB_SCHEMA: z.string(),
    SOURCE_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    TARGET_DB_USERNAME: z.string(),
    TARGET_DB_PASSWORD: z.string(),
    TARGET_DB_HOST: z.string(),
    TARGET_DB_PORT: z.coerce.number(),
    TARGET_DB_NAME: z.string(),
    TARGET_DB_SCHEMA: z.string(),
    TARGET_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    sourceDbUsername: c.SOURCE_DB_USERNAME,
    sourceDbPassword: encodeURIComponent(c.SOURCE_DB_PASSWORD),
    sourceDbHost: c.SOURCE_DB_HOST,
    sourceDbPort: c.SOURCE_DB_PORT,
    sourceDbName: c.SOURCE_DB_NAME,
    sourceDbSchema: c.SOURCE_DB_SCHEMA,
    sourceDbUseSSL: c.SOURCE_DB_USE_SSL,
    targetDbUsername: c.TARGET_DB_USERNAME,
    targetDbPassword: encodeURIComponent(c.TARGET_DB_PASSWORD),
    targetDbHost: c.TARGET_DB_HOST,
    targetDbPort: c.TARGET_DB_PORT,
    targetDbName: c.TARGET_DB_NAME,
    targetDbSchema: c.TARGET_DB_SCHEMA,
    targetDbUseSSL: c.TARGET_DB_USE_SSL,
  }));
export type EventMigrationConfig = z.infer<typeof EventMigrationConfig>;

export const config: EventMigrationConfig = EventMigrationConfig.parse(
  process.env
);
