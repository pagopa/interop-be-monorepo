import { z } from "zod";

export const EventStoreConfig = z
  .object({
    EVENTSTORE_DB_HOST: z.string(),
    EVENTSTORE_DB_NAME: z.string(),
    EVENTSTORE_DB_USERNAME: z.string(),
    EVENTSTORE_DB_PASSWORD: z.string(),
    EVENTSTORE_DB_PORT: z.coerce.number().min(1001),
    EVENTSTORE_DB_SCHEMA: z.string(),
    EVENTSTORE_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    eventStoreDbHost: c.EVENTSTORE_DB_HOST,
    eventStoreDbName: c.EVENTSTORE_DB_NAME,
    eventStoreDbUsername: c.EVENTSTORE_DB_USERNAME,
    eventStoreDbPassword: encodeURIComponent(c.EVENTSTORE_DB_PASSWORD),
    eventStoreDbPort: c.EVENTSTORE_DB_PORT,
    eventStoreDbSchema: c.EVENTSTORE_DB_SCHEMA,
    eventStoreDbUseSSL: c.EVENTSTORE_DB_USE_SSL,
  }));

export type EventStoreConfig = z.infer<typeof EventStoreConfig>;
