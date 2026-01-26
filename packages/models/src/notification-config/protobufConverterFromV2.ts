import { unsafeBrandId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import {
  NotificationConfigV2,
  TenantNotificationConfigV2,
  UserNotificationConfigV2,
  UserRoleV2,
} from "../gen/v2/notification-config/notification-config.js";
import { UserRole, userRole } from "../user/user.js";
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
): TenantNotificationConfig => ({
  ...input,
  id: unsafeBrandId(input.id),
  tenantId: unsafeBrandId(input.tenantId),
  enabled: input.enabled,
  createdAt: bigIntToDate(input.createdAt),
  updatedAt: bigIntToDate(input.updatedAt),
});

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
  if (input.userRoles.length === 0) {
    throw genericError(
      `Error while deserializing UserNotificationConfigV2 (${input.id}): userRoles is empty`
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    userId: unsafeBrandId(input.userId),
    tenantId: unsafeBrandId(input.tenantId),
    inAppNotificationPreference: input.inAppNotificationPreference,
    emailNotificationPreference: input.emailNotificationPreference,
    emailDigestPreference: input.emailDigestPreference,
    inAppConfig: fromNotificationConfigV2(input.inAppConfig),
    emailConfig: fromNotificationConfigV2(input.emailConfig),
    userRoles: [
      fromUserRoleV2(input.userRoles[0]),
      ...input.userRoles.slice(1).map(fromUserRoleV2),
    ],
    createdAt: bigIntToDate(input.createdAt),
    updatedAt: bigIntToDate(input.updatedAt),
  };
};

const fromUserRoleV2 = (input: UserRoleV2): UserRole => {
  switch (input) {
    case UserRoleV2.ADMIN:
      return userRole.ADMIN_ROLE;
    case UserRoleV2.API:
      return userRole.API_ROLE;
    case UserRoleV2.SECURITY:
      return userRole.SECURITY_ROLE;
    case UserRoleV2.SUPPORT:
      return userRole.SUPPORT_ROLE;
  }
};
