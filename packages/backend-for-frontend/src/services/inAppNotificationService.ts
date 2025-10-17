import { assertFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { InAppNotificationManagerClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder(
  inAppNotificationManagerClient: InAppNotificationManagerClient
) {
  return {
    getNotifications: (
      q: string | undefined,
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<inAppNotificationApi.Notifications> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Getting notifications");
      return inAppNotificationManagerClient.getNotifications({
        headers,
        queries: {
          q,
          offset,
          limit,
        },
      });
    },
    getNotificationsByType: ({
      headers,
      logger,
    }: WithLogger<BffAppContext>): Promise<inAppNotificationApi.NotificationsByType> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Getting notifications by type");
      return inAppNotificationManagerClient.getNotificationsByType({
        headers,
      });
    },
    markNotificationsAsRead: (
      ids: string[],
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Marking notifications as read");
      return inAppNotificationManagerClient.markNotificationsAsRead(
        { ids },
        { headers }
      );
    },
    markNotificationAsRead: (
      notificationId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(`Marking notification ${notificationId} as read`);
      return inAppNotificationManagerClient.markNotificationAsRead(undefined, {
        params: { notificationId },
        headers,
      });
    },
    markNotificationAsUnread: (
      notificationId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(`Marking notification ${notificationId} as unread`);
      return inAppNotificationManagerClient.markNotificationAsUnread(
        undefined,
        {
          params: { notificationId },
          headers,
        }
      );
    },
    markNotificationsAsUnread: (
      ids: string[],
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Marking notifications as unread");
      return inAppNotificationManagerClient.markNotificationsAsUnread(
        { ids },
        { headers }
      );
    },
    markAsReadByEntityId: (
      entityId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Marking in-app notifications as read by entity id");
      return inAppNotificationManagerClient.markNotificationsAsReadByEntityId(
        undefined,
        {
          headers,
          params: {
            entityId,
          },
        }
      );
    },
    deleteNotifications: (
      ids: string[],
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Deleting notifications");
      return inAppNotificationManagerClient.deleteNotifications(
        { ids },
        { headers }
      );
    },
    deleteNotification: (
      notificationId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(`Deleting notification ${notificationId}`);
      return inAppNotificationManagerClient.deleteNotification(undefined, {
        params: { notificationId },
        headers,
      });
    },
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
