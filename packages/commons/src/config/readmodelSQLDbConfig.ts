import { z } from "zod";

export const ReadModelSQLDbConfig = z
  .object({
    READMODEL_SQL_DB_HOST: z.string(),
    READMODEL_SQL_DB_NAME: z.string(),
    READMODEL_SQL_DB_USERNAME: z.string(),
    READMODEL_SQL_DB_PASSWORD: z.string(),
    READMODEL_SQL_DB_PORT: z.coerce.number().min(1001),
    // READMODEL_SQL_DB_SCHEMA: z.string(),
    READMODEL_SQL_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    readModelSQLDbHost: c.READMODEL_SQL_DB_HOST,
    readModelSQLDbName: c.READMODEL_SQL_DB_NAME,
    readModelSQLDbUsername: c.READMODEL_SQL_DB_USERNAME,
    readModelSQLDbPassword: c.READMODEL_SQL_DB_PASSWORD,
    readModelSQLDbPort: c.READMODEL_SQL_DB_PORT,
    // readModelSQLDbSchema: c.READMODEL_SQL_DB_SCHEMA,
    readModelSQLDbUseSSL: c.READMODEL_SQL_DB_USE_SSL,
  }));

export type ReadModelSQLDbConfig = z.infer<typeof ReadModelSQLDbConfig>;
