import { z } from "zod";
import { UserId, TenantId, NotificationId } from "../brandedIds.js";
import { NotificationConfig } from "../notification-config/notificationConfig.js";

export const NotificationType = NotificationConfig.keyof();
export type NotificationType = z.infer<typeof NotificationType>;

export const Notification = z.object({
  id: NotificationId,
  userId: UserId,
  tenantId: TenantId,
  body: z.string(),
  deepLink: z.string(),
  readAt: z.date().optional(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof Notification>;
