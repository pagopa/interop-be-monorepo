import { drizzle } from "drizzle-orm/node-postgres";
import {
  AppContext,
  createListResult,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { and, eq, ilike, desc } from "drizzle-orm";
import { ListResult } from "pagopa-interop-models";
import { withTotalCount } from "pagopa-interop-commons";
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
        .select(
          withTotalCount({
            id: notification.id,
            userId: notification.userId,
            tenantId: notification.tenantId,
            body: notification.body,
            deepLink: notification.deepLink,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
          })
        )
        .from(notification)
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId),
            ilike(notification.body, `%${q ?? ""}%`)
          )
        )
        .orderBy(desc(notification.createdAt))
        .limit(limit)
        .offset(offset);

      return createListResult(
        notifications.map((n) => ({
          id: n.id,
          userId: n.userId,
          tenantId: n.tenantId,
          body: n.body,
          deepLink: n.deepLink,
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        notifications[0].totalCount
      );
    },
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
