import {
  NotificationConfigEventEnvelope,
  fromTenantNotificationConfigV2,
  fromUserNotificationConfigV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { NotificationConfigReadModelWriteService } from "./readModelService.js";

export async function handleMessageV2(
  message: NotificationConfigEventEnvelope,
  notificationConfigReadModelWriteService: NotificationConfigReadModelWriteService
): Promise<void> {
  await match(message)
    .with({ type: "TenantNotificationConfigUpdated" }, async (message) => {
      const metadataVersion = message.version;
      if (!message.data.tenantNotificationConfig) {
        throw genericInternalError(
          "Notification config can't be missing in event message"
        );
      }
      const tenantNotificationConfig = fromTenantNotificationConfigV2(
        message.data.tenantNotificationConfig
      );
      await notificationConfigReadModelWriteService.upsertTenantNotificationConfig(
        tenantNotificationConfig,
        metadataVersion
      );
    })
    .with({ type: "UserNotificationConfigUpdated" }, async (message) => {
      const metadataVersion = message.version;
      if (!message.data.userNotificationConfig) {
        throw genericInternalError(
          "Notification config can't be missing in event message"
        );
      }
      const userNotificationConfig = fromUserNotificationConfigV2(
        message.data.userNotificationConfig
      );
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        metadataVersion
      );
    })
    .exhaustive();
}
