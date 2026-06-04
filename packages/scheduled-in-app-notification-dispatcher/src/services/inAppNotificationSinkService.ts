import { drizzle } from "drizzle-orm/node-postgres";
import { Logger } from "pagopa-interop-commons";
import { NewNotification, toNotificationSQL } from "pagopa-interop-models";
import { notification } from "pagopa-interop-in-app-notification-db-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationSinkBuilder(
  notificationDB: ReturnType<typeof drizzle>,
  log: Logger
) {
  return {
    async insertNotifications(notifications: NewNotification[]): Promise<void> {
      if (notifications.length === 0) {
        return;
      }
      try {
        await notificationDB
          .insert(notification)
          .values(notifications.map(toNotificationSQL));
      } catch (err) {
        log.error(
          `Error inserting ${notifications.length} in-app notifications. Affected (tenantId, userId): ${notifications
            .map((n) => `(${n.tenantId}, ${n.userId})`)
            .join(", ")} - error: ${String(err)}`
        );
        throw err;
      }
    },
  };
}
