import { z } from "zod";

export const UserSQLDbConfig = z
  .object({
    USER_SQL_DB_HOST: z.string().default("localhost"),
    USER_SQL_DB_NAME: z.string().default("root"),
    USER_SQL_DB_USERNAME: z.string().default("root"),
    USER_SQL_DB_PASSWORD: z.string().default("root"),
    USER_SQL_DB_PORT: z.coerce.number().min(1001).default(6005),
    USER_SQL_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    USER_SQL_DB_SCHEMA: z.string().default("user"),
  })
  .transform((c) => ({
    userSQLDbHost: c.USER_SQL_DB_HOST,
    userSQLDbName: c.USER_SQL_DB_NAME,
    userSQLDbUsername: c.USER_SQL_DB_USERNAME,
    userSQLDbPassword: c.USER_SQL_DB_PASSWORD,
    userSQLDbPort: c.USER_SQL_DB_PORT,
    userSQLDbUseSSL: c.USER_SQL_DB_USE_SSL,
    userSQLDbSchema: c.USER_SQL_DB_SCHEMA,
  }));

export type UserSQLDbConfig = z.infer<typeof UserSQLDbConfig>;
