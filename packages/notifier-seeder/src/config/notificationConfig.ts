import { z } from "zod";

export const NotificationConfig = z
  .object({
    NOTIFICATION_QUEUE_URL: z.string(),
  })
  .transform((c) => ({
    queueUrl: c.NOTIFICATION_QUEUE_URL,
  }));
export type NotificationConfig = z.infer<typeof NotificationConfig>;

export const notificationConfig = (): NotificationConfig =>
  NotificationConfig.parse(process.env);
