import { isFeatureFlagEnabled, WithLogger } from "pagopa-interop-commons";
import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { BffAppContext } from "./context.js";

export async function filterUnreadNotifications(
  inAppNotificationManagerClient: inAppNotificationApi.InAppNotificationManagerClient,
  entityIds: string[],
  ctx: WithLogger<BffAppContext>
): Promise<string[]> {
  return isFeatureFlagEnabled(config, "featureFlagNotificationConfig")
    ? inAppNotificationManagerClient
        .filterUnreadNotifications({
          queries: {
            entityIds,
          },
          headers: ctx.headers,
        })
        .catch((err) => {
          ctx.logger.error(`Error while fetching unread notifications: ${err}`);
          return [];
        })
    : Promise.resolve([]);
}
