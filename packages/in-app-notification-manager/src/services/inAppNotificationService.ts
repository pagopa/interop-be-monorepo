import { drizzle } from "drizzle-orm/node-postgres";
import { AppContext, UIAuthData, WithLogger } from "pagopa-interop-commons";
import { and, eq, ilike, desc } from "drizzle-orm";
import { ListResult } from "pagopa-interop-models";
import { notification, Notification } from "../db/schema.js";
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    getNotifications: async (
      q: string | undefined,
      limit: number,
      offset: number,
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ListResult<Notification>> => {
      logger.info("Getting notifications");
      const notifications = await db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId),
            ilike(notification.body, `%${q ?? ""}%`)
          )
        )
        .orderBy(desc(notification.createdAt));

      return {
        results: notifications.slice(offset, offset + limit),
        totalCount: notifications.length,
      };
    },
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
