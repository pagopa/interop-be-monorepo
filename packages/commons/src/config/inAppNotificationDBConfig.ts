import { z } from "zod";

export const InAppNotificationDBConfig = z
  .object({
    IN_APP_NOTIFICATION_DB_HOST: z.string().default("localhost"),
    IN_APP_NOTIFICATION_DB_NAME: z.string().default("root"),
    IN_APP_NOTIFICATION_DB_USERNAME: z.string().default("root"),
    IN_APP_NOTIFICATION_DB_PASSWORD: z.string().default("root"),
    IN_APP_NOTIFICATION_DB_PORT: z.coerce.number().min(1001).default(6004),
    IN_APP_NOTIFICATION_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    IN_APP_NOTIFICATION_DB_SCHEMA: z.string().default("notification"),
  })
  .transform((c) => ({
    inAppNotificationDBHost: c.IN_APP_NOTIFICATION_DB_HOST,
    inAppNotificationDBName: c.IN_APP_NOTIFICATION_DB_NAME,
    inAppNotificationDBUsername: c.IN_APP_NOTIFICATION_DB_USERNAME,
    inAppNotificationDBPassword: c.IN_APP_NOTIFICATION_DB_PASSWORD,
    inAppNotificationDBPort: c.IN_APP_NOTIFICATION_DB_PORT,
    inAppNotificationDBUseSSL: c.IN_APP_NOTIFICATION_DB_USE_SSL,
    inAppNotificationDBSchema: c.IN_APP_NOTIFICATION_DB_SCHEMA,
  }));

export type InAppNotificationDBConfig = z.infer<
  typeof InAppNotificationDBConfig
>;
