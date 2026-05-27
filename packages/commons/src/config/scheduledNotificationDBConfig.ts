import { z } from "zod";

export const ScheduledNotificationDBConfig = z
  .object({
    SCHEDULED_NOTIFICATION_DB_HOST: z.string().default("localhost"),
    SCHEDULED_NOTIFICATION_DB_NAME: z.string().default("root"),
    SCHEDULED_NOTIFICATION_DB_USERNAME: z.string().default("root"),
    SCHEDULED_NOTIFICATION_DB_PASSWORD: z.string().default("root"),
    SCHEDULED_NOTIFICATION_DB_PORT: z.coerce.number().min(1001).default(6009),
    SCHEDULED_NOTIFICATION_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    SCHEDULED_NOTIFICATION_DB_SCHEMA: z
      .string()
      .default("scheduled_notification"),
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
