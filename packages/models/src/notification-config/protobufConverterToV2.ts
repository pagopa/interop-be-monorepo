import {
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
} from "../gen/v2/notification-config/notification-config.js";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "./notificationConfig.js";

export const toTenantNotificationConfigV2 = (
  input: TenantNotificationConfig
): TenantNotificationConfigV2 => input;

export const toUserNotificationConfigV2 = (
  input: UserNotificationConfig
): UserNotificationConfigV2 => input;
