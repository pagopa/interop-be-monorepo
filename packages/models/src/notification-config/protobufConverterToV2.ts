import {
  EmailNotificationPreferenceV2,
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
  UserRoleV2,
} from "../gen/v2/notification-config/notification-config.js";
import { UserRole, userRole } from "../user/user.js";
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
  userRoles: userNotificationConfig.userRoles.map(toUserRoleV2),
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

export const toUserRoleV2 = (input: UserRole): UserRoleV2 => {
  switch (input) {
    case userRole.ADMIN_ROLE:
      return UserRoleV2.ADMIN;
    case userRole.API_ROLE:
      return UserRoleV2.API;
    case userRole.SECURITY_ROLE:
      return UserRoleV2.SECURITY;
    case userRole.SUPPORT_ROLE:
      return UserRoleV2.SUPPORT;
  }
};
