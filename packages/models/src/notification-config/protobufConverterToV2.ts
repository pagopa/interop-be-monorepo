import {
  EmailNotificationPreferenceV2,
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
} from "../gen/v2/notification-config/notification-config.js";
import { dateToBigInt } from "../utils.js";
import {
  emailNotificationPreference,
  EmailNotificationPreference,
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
  emailNotificationPreference: toEmailNotificationPreferenceV2(
    userNotificationConfig.emailNotificationPreference
  ),
  createdAt: dateToBigInt(userNotificationConfig.createdAt),
  updatedAt: dateToBigInt(userNotificationConfig.updatedAt),
});

export const toEmailNotificationPreferenceV2 = (
  input: EmailNotificationPreference
): EmailNotificationPreferenceV2 => {
  switch (input) {
    case emailNotificationPreference.disabled:
      return EmailNotificationPreferenceV2.DISABLED;
    case emailNotificationPreference.enabled:
      return EmailNotificationPreferenceV2.ENABLED;
    case emailNotificationPreference.digest:
      return EmailNotificationPreferenceV2.DIGEST;
  }
};
