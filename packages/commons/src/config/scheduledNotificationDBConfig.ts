import { z } from "zod";

export const ScheduledNotificationDBConfig = z
  .object({
    SCHEDULED_NOTIFICATION_DB_HOST: z.string(),
    SCHEDULED_NOTIFICATION_DB_NAME: z.string(),
    SCHEDULED_NOTIFICATION_DB_USERNAME: z.string(),
    SCHEDULED_NOTIFICATION_DB_PASSWORD: z.string(),
    SCHEDULED_NOTIFICATION_DB_PORT: z.coerce.number().min(1001),
    SCHEDULED_NOTIFICATION_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    SCHEDULED_NOTIFICATION_DB_SCHEMA: z.string(),
  })
  .transform((c) => ({
    scheduledNotificationDBHost: c.SCHEDULED_NOTIFICATION_DB_HOST,
    scheduledNotificationDBName: c.SCHEDULED_NOTIFICATION_DB_NAME,
    scheduledNotificationDBUsername: c.SCHEDULED_NOTIFICATION_DB_USERNAME,
    scheduledNotificationDBPassword: c.SCHEDULED_NOTIFICATION_DB_PASSWORD,
    scheduledNotificationDBPort: c.SCHEDULED_NOTIFICATION_DB_PORT,
    scheduledNotificationDBUseSSL: c.SCHEDULED_NOTIFICATION_DB_USE_SSL,
    scheduledNotificationDBSchema: c.SCHEDULED_NOTIFICATION_DB_SCHEMA,
  }));

export type ScheduledNotificationDBConfig = z.infer<
  typeof ScheduledNotificationDBConfig
>;
