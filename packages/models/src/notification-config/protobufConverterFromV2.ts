import { unsafeBrandId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import {
  NotificationConfigV2,
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
} from "../gen/v2/notification-config/notification-config.js";
import { bigIntToDate } from "../utils.js";
import {
  NotificationConfig,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "./notificationConfig.js";

export const fromNotificationConfigV2 = (
  input: NotificationConfigV2
): NotificationConfig => ({
  ...input,
});

export const fromTenantNotificationConfigV2 = (
  input: TenantNotificationConfigV2
): TenantNotificationConfig => {
  if (!input.config) {
    throw genericError(
      `Error while deserializing TenantNotificationConfigV2 (${input.id}): missing config`
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    tenantId: unsafeBrandId(input.tenantId),
    config: fromNotificationConfigV2(input.config),
    createdAt: bigIntToDate(input.createdAt),
    updatedAt: bigIntToDate(input.updatedAt),
  };
};

export const fromUserNotificationConfigV2 = (
  input: UserNotificationConfigV2
): UserNotificationConfig => {
  if (!input.inAppConfig) {
    throw genericError(
      `Error while deserializing UserNotificationConfigV2 (${input.id}): missing inAppConfig`
    );
  }
  if (!input.emailConfig) {
    throw genericError(
      `Error while deserializing UserNotificationConfigV2 (${input.id}): missing emailConfig`
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    userId: unsafeBrandId(input.userId),
    tenantId: unsafeBrandId(input.tenantId),
    inAppConfig: fromNotificationConfigV2(input.inAppConfig),
    emailConfig: fromNotificationConfigV2(input.emailConfig),
    createdAt: bigIntToDate(input.createdAt),
    updatedAt: bigIntToDate(input.updatedAt),
  };
};
