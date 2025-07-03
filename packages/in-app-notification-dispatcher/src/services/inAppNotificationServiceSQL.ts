import { generateId } from "pagopa-interop-models";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import { drizzle } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilderSQL(
  notificationDB: ReturnType<typeof drizzle>
) {
  return {
    async insertNotifications(
      userNotificationConfigs: Array<{
        userId: string;
        tenantId: string;
        body: string;
        deepLink: string;
      }>
    ): Promise<void> {
      if (userNotificationConfigs.length === 0) {
        return;
      }
      await notificationDB.insert(notification).values(
        userNotificationConfigs.map(({ userId, tenantId, body, deepLink }) => ({
          id: generateId(),
          tenantId,
          userId,
          body,
          deepLink,
          createdAt: new Date().toISOString(),
          readAt: null,
        }))
      );
    },
  };
}

export type InAppNotificationServiceSQL = ReturnType<
  typeof inAppNotificationServiceBuilderSQL
>;
