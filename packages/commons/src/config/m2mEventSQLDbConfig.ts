import { z } from "zod";

export const M2MEventSQLDbConfig = z
  .object({
    M2M_EVENT_DB_HOST: z.string().default("localhost"),
    M2M_EVENT_DB_NAME: z.string().default("root"),
    M2M_EVENT_DB_USERNAME: z.string().default("root"),
    M2M_EVENT_DB_PASSWORD: z.string().default("root"),
    M2M_EVENT_DB_PORT: z.coerce.number().min(1001).default(6006),
    M2M_EVENT_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    M2M_EVENT_DB_SCHEMA: z.string().default("m2m_event"),
  })
  .transform((c) => ({
    m2mEventSQLDbHost: c.M2M_EVENT_DB_HOST,
    m2mEventSQLDbName: c.M2M_EVENT_DB_NAME,
    m2mEventSQLDbUsername: c.M2M_EVENT_DB_USERNAME,
    m2mEventSQLDbPassword: c.M2M_EVENT_DB_PASSWORD,
    m2mEventSQLDbPort: c.M2M_EVENT_DB_PORT,
    m2mEventSQLDbUseSSL: c.M2M_EVENT_DB_USE_SSL,
    m2mEventSQLDbSchema: c.M2M_EVENT_DB_SCHEMA,
  }));

export type M2MEventSQLDbConfig = z.infer<typeof M2MEventSQLDbConfig>;
