import { Logger } from "pagopa-interop-commons";
import {
  NotificationConfigEventEnvelope,
  fromTenantNotificationConfigV2,
  fromUserNotificationConfigV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { NotificationConfigReadModelWriteService } from "./readModelWriteService.js";

export async function handleMessageV2(
  message: NotificationConfigEventEnvelope,
  notificationConfigReadModelWriteService: NotificationConfigReadModelWriteService,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "TenantNotificationConfigCreated",
          "TenantNotificationConfigUpdated"
        ),
      },
      async (message) => {
        if (!message.data.tenantNotificationConfig) {
          throw genericInternalError(
            "Notification config can't be missing in event message"
          );
        }
        await notificationConfigReadModelWriteService.upsertTenantNotificationConfig(
          fromTenantNotificationConfigV2(message.data.tenantNotificationConfig),
          message.version
        );
      }
    )
    .with({ type: "UserNotificationConfigCreated" }, async (message) => {
      if (!message.data.userNotificationConfig) {
        throw genericInternalError(
          "Notification config can't be missing in event message"
        );
      }
      await notificationConfigReadModelWriteService.upsertOrMergeUserNotificationConfigOnCreate(
        fromUserNotificationConfigV2(message.data.userNotificationConfig),
        message.version,
        logger
      );
    })
    .with(
      {
        type: P.union(
          "UserNotificationConfigUpdated",
          "UserNotificationConfigRoleAdded",
          "UserNotificationConfigRoleRemoved"
        ),
      },
      async (message) => {
        if (!message.data.userNotificationConfig) {
          throw genericInternalError(
            "Notification config can't be missing in event message"
          );
        }
        await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
          fromUserNotificationConfigV2(message.data.userNotificationConfig),
          message.version
        );
      }
    )
    .with({ type: "TenantNotificationConfigDeleted" }, async (message) => {
      if (!message.data.tenantNotificationConfig) {
        throw genericInternalError(
          "Notification config can't be missing in event message"
        );
      }
      await notificationConfigReadModelWriteService.deleteTenantNotificationConfig(
        unsafeBrandId(message.data.tenantNotificationConfig.id)
      );
    })
    .with({ type: "UserNotificationConfigDeleted" }, async (message) => {
      if (!message.data.userNotificationConfig) {
        throw genericInternalError(
          "Notification config can't be missing in event message"
        );
      }
      await notificationConfigReadModelWriteService.deleteUserNotificationConfig(
        unsafeBrandId(message.data.userNotificationConfig.id)
      );
    })
    .exhaustive();
}
