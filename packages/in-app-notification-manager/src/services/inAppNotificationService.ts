import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  like,
  or,
} from "drizzle-orm";
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
  NotificationsByType,
  NotificationType,
} from "pagopa-interop-models";
import { notificationNotFound } from "../model/errors.js";
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder(
  db: ReturnType<typeof drizzle>
) {
  return {
    // eslint-disable-next-line max-params
    hasUnreadNotifications: async (
      entityIds: string[],
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<string[]> => {
      logger.info("Checking for unread notifications");

      if (entityIds.length === 0) {
        return [];
      }

      const idList = await db
        .selectDistinct({ entityId: notification.entityId })
        .from(notification)
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId),
            isNull(notification.readAt),
            or(...entityIds.map((id) => like(notification.entityId, `${id}%`)))
          )
        );

      return idList.map((e) => e.entityId.split("/")[0]);
    },
    // eslint-disable-next-line max-params
    getNotifications: async (
      q: string | undefined,
      unread: boolean | undefined,
      notificationTypes: NotificationType[],
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
            q ? ilike(notification.body, `%${escapeRegExp(q)}%`) : undefined,
            unread ? isNull(notification.readAt) : undefined,
            notificationTypes.length > 0
              ? inArray(notification.notificationType, notificationTypes)
              : undefined
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
      logger.info(`Marking ${ids.join(", ")} notifications as read`);

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
    markNotificationsAsUnread: async (
      ids: NotificationId[],
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Marking ${ids.join(", ")} notifications as unread`);

      if (ids.length === 0) {
        return;
      }

      await db
        .update(notification)
        .set({ readAt: null })
        .where(
          and(
            inArray(notification.id, ids),
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId)
          )
        );
    },
    markNotificationAsUnread: async (
      notificationId: NotificationId,
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Marking notification ${notificationId} as unread`);

      const updated = await db
        .update(notification)
        .set({ readAt: null })
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
    markNotificationsAsReadByEntityId: async (
      entityId: string,
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Marking notifications for entity ${entityId} as read`);

      await db
        .update(notification)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(notification.entityId, entityId),
            eq(notification.userId, userId),
            eq(notification.tenantId, organizationId),
            isNull(notification.readAt)
          )
        );
    },
    deleteNotifications: async (
      notificationIds: NotificationId[],
      {
        logger,
        authData: { userId, organizationId },
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> => {
      logger.info(`Deleting notifications ${notificationIds.join(", ")}`);

      if (notificationIds.length === 0) {
        return;
      }

      await db
        .delete(notification)
        .where(
          and(
            inArray(notification.id, notificationIds),
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
    getNotificationsByType: async ({
      logger,
      authData: { userId, organizationId },
    }: WithLogger<AppContext<UIAuthData>>): Promise<NotificationsByType> => {
      logger.info("Getting notifications by type");

      const [groupedResult, totalCountResult] = await Promise.all([
        db
          .select({
            notificationType: notification.notificationType,
            typeCount: countDistinct(notification.entityId),
          })
          .from(notification)
          .where(
            and(
              eq(notification.userId, userId),
              eq(notification.tenantId, organizationId),
              isNull(notification.readAt)
            )
          )
          .groupBy(notification.notificationType),

        db
          .select({
            totalCount: count(notification.id),
          })
          .from(notification)
          .where(
            and(
              eq(notification.userId, userId),
              eq(notification.tenantId, organizationId),
              isNull(notification.readAt)
            )
          ),
      ]);

      const results = groupedResult.reduce<Record<NotificationType, number>>(
        (acc, row): Record<NotificationType, number> => {
          const notificationType = row.notificationType;
          if (NotificationType.safeParse(notificationType).success) {
            return {
              ...acc,
              [notificationType]: row.typeCount,
            };
          } else {
            logger.warn(
              `Skipping notification type ${notificationType} because it is not a valid notification type`
            );
          }
          return acc;
        },
        {} as Record<NotificationType, number>
      );

      const totalCount = totalCountResult[0]?.totalCount || 0;

      return {
        results,
        totalCount,
      };
    },
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
