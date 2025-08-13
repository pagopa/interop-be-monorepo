import { generateId, NotificationId, unsafeBrandId } from "../brandedIds.js";
import {
  Notification,
  NewNotification,
  NotificationType,
} from "./notification.js";

export type NotificationSQL = {
  id: string;
  userId: string;
  tenantId: string;
  body: string;
  notificationType: string;
  entityId: string;
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
  notificationType: NotificationType.parse(notification.notificationType),
  entityId: unsafeBrandId(notification.entityId),
  createdAt: new Date(notification.createdAt),
  readAt: notification.readAt ? new Date(notification.readAt) : undefined,
});

export const toNotificationSQL = (
  notification: NewNotification
): NotificationSQL => ({
  id: generateId<NotificationId>(),
  userId: notification.userId,
  tenantId: notification.tenantId,
  body: notification.body,
  notificationType: notification.notificationType,
  entityId: notification.entityId,
  createdAt: new Date().toISOString(),
  readAt: null,
});
