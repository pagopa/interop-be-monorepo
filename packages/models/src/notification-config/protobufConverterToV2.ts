import {
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
} from "../gen/v2/notification-config/notification-config.js";
import { dateToBigInt } from "../utils.js";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "./notificationConfig.js";

export const toTenantNotificationConfigV2 = (
  tenantNotificationConfig: TenantNotificationConfig
): TenantNotificationConfigV2 => ({
  ...tenantNotificationConfig,
  createdAt: dateToBigInt(tenantNotificationConfig.createdAt),
  updatedAt: dateToBigInt(tenantNotificationConfig.updatedAt),
});

export const toUserNotificationConfigV2 = (
  userNotificationConfig: UserNotificationConfig
): UserNotificationConfigV2 => ({
  ...userNotificationConfig,
  createdAt: dateToBigInt(userNotificationConfig.createdAt),
  updatedAt: dateToBigInt(userNotificationConfig.updatedAt),
});
