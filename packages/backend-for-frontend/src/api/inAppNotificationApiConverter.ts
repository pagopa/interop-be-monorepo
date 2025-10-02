import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { bffApi } from "pagopa-interop-api-clients";
import { NotificationType } from "pagopa-interop-models";
import {
  notificationTypeToCategory,
  notificationTypeToUiSection,
  UiSection,
} from "../model/modelMappingUtils.js";

function getNotificationTypesCount(
  results: Partial<Record<NotificationType, number>>,
  sectionPath: UiSection
): number {
  return (Object.keys(notificationTypeToUiSection) as NotificationType[])
    .filter((notificationType) =>
      notificationTypeToUiSection[notificationType].startsWith(sectionPath)
    )
    .reduce((sum, type) => sum + (results[type] ?? 0), 0);
}

export function toBffApiNotificationsCountBySection({
  results,
  totalCount,
}: inAppNotificationApi.NotificationsByType): bffApi.NotificationsCountBySection {
  return {
    erogazione: {
      richieste: getNotificationTypesCount(results, "/erogazione/richieste"),
      finalita: getNotificationTypesCount(results, "/erogazione/finalita"),
      "template-eservice": getNotificationTypesCount(
        results,
        "/erogazione/template-eservice"
      ),
      "e-service": getNotificationTypesCount(results, "/erogazione/e-service"),
      portachiavi: getNotificationTypesCount(
        results,
        "/erogazione/portachiavi"
      ),
      totalCount: getNotificationTypesCount(results, "/erogazione"),
    },
    fruizione: {
      richieste: getNotificationTypesCount(results, "/fruizione/richieste"),
      finalita: getNotificationTypesCount(results, "/fruizione/finalita"),
      totalCount: getNotificationTypesCount(results, "/fruizione"),
    },
    "catalogo-e-service": {
      totalCount: getNotificationTypesCount(results, "/catalogo-e-service"),
    },
    aderente: {
      deleghe: getNotificationTypesCount(results, "/aderente/deleghe"),
      anagrafica: getNotificationTypesCount(results, "/aderente/anagrafica"),
      totalCount: getNotificationTypesCount(results, "/aderente"),
    },
    totalCount,
  };
}

export function toBffApiNotifications(
  notifications: inAppNotificationApi.Notifications
): bffApi.Notifications {
  return {
    totalCount: notifications.totalCount,
    results: notifications.results.map((notification) => ({
      id: notification.id,
      tenantId: notification.tenantId,
      userId: notification.userId,
      body: notification.body,
      deepLink: notificationTypeToUiSection[notification.notificationType],
      category: notificationTypeToCategory[notification.notificationType],
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    })),
  };
}
