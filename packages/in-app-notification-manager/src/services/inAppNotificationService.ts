import { and, desc, eq, getTableColumns, ilike, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  AppContext,
  createListResult,
  escapeRegExp,
  UIAuthData,
  WithLogger,
  withTotalCount,
} from "pagopa-interop-commons";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import {
  fromNotificationSQL,
  ListResult,
  Notification,
  NotificationId,
} from "pagopa-interop-models";
import { notificationNotFound } from "../model/errors.js";
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
        .select(withTotalCount(getTableColumns(notification)))
        .from(notification)
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId),
            q ? ilike(notification.body, `%${escapeRegExp(q)}%`) : undefined
          )
        )
        .orderBy(desc(notification.createdAt))
        .limit(limit)
        .offset(offset);

      return createListResult(
        notifications.map(({ totalCount: _, ...n }) => fromNotificationSQL(n)),
        notifications[0]?.totalCount ?? 0
      );
    },
    markNotificationAsRead: async (
      notificationId: NotificationId,
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Marking notification ${notificationId} as read`);

      const updated = await db
        .update(notification)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(notification.id, notificationId),
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId)
          )
        )
        .returning({ id: notification.id });

      if (!updated.length) {
        throw notificationNotFound(notificationId);
      }
    },
    markNotificationsAsRead: async (
      ids: NotificationId[],
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Marking ${ids.length} notifications as read`);

      if (ids.length === 0) {
        return;
      }

      await db
        .update(notification)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            inArray(notification.id, ids),
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId)
          )
        );
    },
    deleteNotification: async (
      notificationId: NotificationId,
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Deleting notification ${notificationId}`);

      const deleted = await db
        .delete(notification)
        .where(
          and(
            eq(notification.id, notificationId),
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId)
          )
        )
        .returning({ id: notification.id });

      if (!deleted.length) {
        throw notificationNotFound(notificationId);
      }
    },
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
