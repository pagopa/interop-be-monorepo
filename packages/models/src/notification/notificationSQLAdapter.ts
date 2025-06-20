import { unsafeBrandId } from "../brandedIds.js";
import { Notification } from "./notification.js";

export type NotificationSQL = {
  id: string;
  userId: string;
  tenantId: string;
  body: string;
  deepLink: string;
  createdAt: string;
  readAt?: string | null;
};

export const fromNotificationSQL = (
  notification: NotificationSQL
): Notification => ({
  id: unsafeBrandId(notification.id),
  userId: unsafeBrandId(notification.userId),
  tenantId: unsafeBrandId(notification.tenantId),
  body: notification.body,
  deepLink: notification.deepLink,
  createdAt: new Date(notification.createdAt),
  readAt: notification.readAt ? new Date(notification.readAt) : undefined,
});
