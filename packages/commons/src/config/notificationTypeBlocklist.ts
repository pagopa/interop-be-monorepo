import { z } from "zod";

export const NotificationTypeBlocklistConfig = z
  .object({
    NOTIFICATION_TYPE_BLOCKLIST: z.string().optional(),
  })
  .transform((c) => ({
    notificationTypeBlocklist:
      c.NOTIFICATION_TYPE_BLOCKLIST?.split(",").map((type) => type.trim()) ??
      [],
  }));

export type NotificationTypeBlocklistConfig = z.infer<
  typeof NotificationTypeBlocklistConfig
>;
