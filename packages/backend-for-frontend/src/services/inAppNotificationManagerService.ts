import { assertFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { InAppNotificationManagerClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import {
  Category,
  categoryToNotificationTypes,
} from "../model/modelMappingUtils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder(
  inAppNotificationManagerClient: InAppNotificationManagerClient
) {
  return {
    getNotifications: (
      q: string | undefined,
      category: Category | undefined,
      offset: number,
      limit: number,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<inAppNotificationApi.Notifications> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info("Getting notifications");
      const notificationTypes = category
        ? categoryToNotificationTypes[category]
        : [];

      return inAppNotificationManagerClient.getNotifications({
        headers,
        queries: {
          q,
          notificationTypes,
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
  };
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
