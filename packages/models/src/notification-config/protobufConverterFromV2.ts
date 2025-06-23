import { unsafeBrandId } from "../brandedIds.js";
import {
  NotificationConfigV2,
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
} from "../gen/v2/notification-config/notification-config.js";
import {
  NotificationConfig,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "./notificationConfig.js";

export const defaultNotificationConfig: NotificationConfig = {
  newEServiceVersionPublished: false,
};

export const fromNotificationConfigV2 = (
  input: NotificationConfigV2
): NotificationConfig => ({
  newEServiceVersionPublished: input.newEServiceVersionPublished,
});

export const fromTenantNotificationConfigV2 = (
  input: TenantNotificationConfigV2
): TenantNotificationConfig => ({
  id: unsafeBrandId(input.id),
  tenantId: unsafeBrandId(input.tenantId),
  config:
    input.config != null
      ? fromNotificationConfigV2(input.config)
      : defaultNotificationConfig,
});

export const fromUserNotificationConfigV2 = (
  input: UserNotificationConfigV2
): UserNotificationConfig => ({
  id: unsafeBrandId(input.id),
  userId: unsafeBrandId(input.userId),
  tenantId: unsafeBrandId(input.tenantId),
  inAppConfig:
    input.inAppConfig != null
      ? fromNotificationConfigV2(input.inAppConfig)
      : defaultNotificationConfig,
  emailConfig:
    input.emailConfig != null
      ? fromNotificationConfigV2(input.emailConfig)
      : defaultNotificationConfig,
});
