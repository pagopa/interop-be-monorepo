import { unsafeBrandId } from "../brandedIds.js";
import {
  EServiceConsumerNotificationConfigV2,
  ConsumerNotificationConfigV2,
  NotificationConfigV2,
  NotificationTenantV2,
} from "../gen/v2/notification-config/notification-config.js";
import {
  EServiceConsumerNotificationConfig,
  ConsumerNotificationConfig,
  NotificationConfig,
  NotificationTenant,
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

export const fromNotificationTenantV2 = (
  input: NotificationTenantV2
): NotificationTenant => ({
  id: unsafeBrandId(input.id),
  tenantId: unsafeBrandId(input.tenantId),
  config:
    input.config != null
      ? fromNotificationConfigV2(input.config)
      : defaultNotificationConfig,
});
