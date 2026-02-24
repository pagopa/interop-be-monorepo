import { notification } from "pagopa-interop-in-app-notification-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { NewNotification } from "pagopa-interop-models";
import { toNotificationSQL } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilderSQL(
  notificationDB: ReturnType<typeof drizzle>
) {
  return {
    async insertNotifications(notifications: NewNotification[]): Promise<void> {
      if (notifications.length === 0) {
        return;
      }
      await notificationDB
        .insert(notification)
        .values(notifications.map(toNotificationSQL));
    },
  };
}
