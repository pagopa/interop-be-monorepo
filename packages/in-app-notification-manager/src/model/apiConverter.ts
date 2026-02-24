import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { Notification } from "pagopa-interop-models";

export const notificationToApiNotification = (
  notification: Notification
): inAppNotificationApi.Notification => ({
  id: notification.id,
  userId: notification.userId,
  tenantId: notification.tenantId,
  body: notification.body,
  notificationType: notification.notificationType,
  entityId: notification.entityId,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
});
