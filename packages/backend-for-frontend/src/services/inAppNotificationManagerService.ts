import { WithLogger } from "pagopa-interop-commons";
import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { InAppNotificationManagerClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder(
  inAppNotificationManagerClient: InAppNotificationManagerClient
) {
  return {
    getNotificationsByType: ({
      headers,
      logger,
    }: WithLogger<BffAppContext>): Promise<inAppNotificationApi.NotificationsByType> => {
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
