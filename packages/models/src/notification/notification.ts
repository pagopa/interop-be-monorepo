import { z } from "zod";
import { UserId, TenantId, NotificationId, IDS } from "../brandedIds.js";
import { NotificationConfig } from "../notification-config/notificationConfig.js";

export const NotificationType = NotificationConfig.keyof();

export const Notification = z.object({
  id: NotificationId,
  userId: UserId,
  tenantId: TenantId,
  body: z.string(),
  notificationType: NotificationType,
  entityId: IDS,
  readAt: z.date().optional(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof Notification>;

export const NewNotification = Notification.omit({
  id: true,
  createdAt: true,
  readAt: true,
});
export type NewNotification = z.infer<typeof NewNotification>;
