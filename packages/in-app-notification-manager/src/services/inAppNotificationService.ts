import { drizzle } from "drizzle-orm/node-postgres";
import { AppContext, UIAuthData, WithLogger } from "pagopa-interop-commons";
import { and, eq, desc } from "drizzle-orm";
import { notification, Notification } from "../db/schema.js";
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    getNotifications: ({
      logger,
      authData: { userId, organizationId },
    }: WithLogger<AppContext<UIAuthData>>): Promise<Notification[]> => {
      logger.info("Getting notifications");
      return db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId)
          )
        )
        .orderBy(desc(notification.createdAt));
    },
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
