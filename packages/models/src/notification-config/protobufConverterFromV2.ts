import { unsafeBrandId } from "../brandedIds.js";
import {
  EServiceConsumerNotificationConfigV2,
  ConsumerNotificationConfigV2,
  NotificationConfigV2,
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
} from "../gen/v2/notification-config/notification-config.js";
import {
  EServiceConsumerNotificationConfig,
  ConsumerNotificationConfig,
  NotificationConfig,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "./notificationConfig.js";

export const defaultEServiceConsumerNotificationConfig: EServiceConsumerNotificationConfig =
  {
    newEServiceVersionPublished: false,
  };

export const defaultConsumerNotificationConfig: ConsumerNotificationConfig = {
  eService: defaultEServiceConsumerNotificationConfig,
};

export const defaultNotificationConfig: NotificationConfig = {
  consumer: defaultConsumerNotificationConfig,
};

export const fromEServiceConsumerNotificationConfigV2 = (
  input: EServiceConsumerNotificationConfigV2
): EServiceConsumerNotificationConfig => ({
  newEServiceVersionPublished: input.newEServiceVersionPublished,
});

export const fromConsumerNotificationConfigV2 = (
  input: ConsumerNotificationConfigV2
): ConsumerNotificationConfig => ({
  eService:
    input.eService != null
      ? fromEServiceConsumerNotificationConfigV2(input.eService)
      : defaultEServiceConsumerNotificationConfig,
});

export const fromNotificationConfigV2 = (
  input: NotificationConfigV2
): NotificationConfig => ({
  consumer:
    input.consumer != null
      ? fromConsumerNotificationConfigV2(input.consumer)
      : defaultConsumerNotificationConfig,
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
