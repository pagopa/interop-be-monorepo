import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { Notification } from "pagopa-interop-models";

export const notificationToApiNotification = (
  notification: Notification
): inAppNotificationApi.Notification => {
  const notificationType =
    notification.notificationType as inAppNotificationApi.Notification["notificationType"];

  return {
    id: notification.id,
    userId: notification.userId,
    tenantId: notification.tenantId,
    body: notification.body,
    notificationType,
    entityId: notification.entityId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
};
