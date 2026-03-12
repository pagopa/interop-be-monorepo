import {
  NotificationConfig,
  NotificationType,
  TenantNotificationConfig,
  UserNotificationConfig,
  UserNotificationConfigId,
  dateToString,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigSQL,
  UserNotificationConfigItemsSQL,
} from "pagopa-interop-readmodel-models";

export const splitTenantNotificationConfigIntoObjectsSQL = (
  {
    id,
    tenantId,
    enabled,
    createdAt,
    updatedAt,
    ...rest
  }: TenantNotificationConfig,
  metadataVersion: number
): TenantNotificationConfigSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    metadataVersion,
    tenantId,
    enabled,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
  };
};

export const splitUserNotificationConfigIntoObjectsSQL = (
  {
    id,
    userId,
    tenantId,
    userRoles,
    inAppNotificationPreference,
    emailNotificationPreference,
    emailDigestPreference,
    inAppConfig,
    emailConfig,
    createdAt,
    updatedAt,
    ...rest
  }: UserNotificationConfig,
  metadataVersion: number
): UserNotificationConfigItemsSQL & {
  enabledInAppNotificationsSQL: Array<{ notificationType: NotificationType }>;
  enabledEmailNotificationsSQL: Array<{ notificationType: NotificationType }>;
} => {
  void (rest satisfies Record<string, never>);

  const makeEnabledNotifications = (
    config: NotificationConfig
  ): Array<{
    notificationType: NotificationType;
    userNotificationConfigId: UserNotificationConfigId;
    metadataVersion: number;
  }> =>
    NotificationType.options
      .filter((notificationType) => config[notificationType])
      .map((notificationType) => ({
        notificationType,
        userNotificationConfigId: id,
        metadataVersion,
      }));

  return {
    userNotificationConfigSQL: {
      id,
      metadataVersion,
      userId,
      tenantId,
      userRoles,
      inAppNotificationPreference,
      emailNotificationPreference,
      emailDigestPreference,
      createdAt: dateToString(createdAt),
      updatedAt: dateToString(updatedAt),
    },
    enabledInAppNotificationsSQL: makeEnabledNotifications(inAppConfig),
    enabledEmailNotificationsSQL: makeEnabledNotifications(emailConfig),
  };
};
