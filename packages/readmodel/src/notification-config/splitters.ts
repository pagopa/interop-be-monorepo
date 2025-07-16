import {
  NotificationConfig,
  TenantNotificationConfig,
  UserNotificationConfig,
  UserNotificationConfigId,
  dateToString,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigItemsSQL,
  UserNotificationConfigItemsSQL,
} from "pagopa-interop-readmodel-models";
import { NotificationType } from "./utils.js";

export const splitTenantNotificationConfigIntoObjectsSQL = (
  {
    id,
    tenantId,
    config,
    createdAt,
    updatedAt,
    ...rest
  }: TenantNotificationConfig,
  metadataVersion: number
): TenantNotificationConfigItemsSQL & {
  enabledNotificationsSQL: Array<{ notificationType: NotificationType }>;
} => {
  void (rest satisfies Record<string, never>);

  return {
    tenantNotificationConfigSQL: {
      id,
      metadataVersion,
      tenantId,
      createdAt: dateToString(createdAt),
      updatedAt: dateToString(updatedAt),
    },
    enabledNotificationsSQL: NotificationType.options
      .filter((notificationType) => config[notificationType])
      .map((notificationType) => ({
        notificationType,
        tenantNotificationConfigId: id,
        metadataVersion,
      })),
  };
};

export const splitUserNotificationConfigIntoObjectsSQL = (
  {
    id,
    userId,
    tenantId,
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
      createdAt: dateToString(createdAt),
      updatedAt: dateToString(updatedAt),
    },
    enabledInAppNotificationsSQL: makeEnabledNotifications(inAppConfig),
    enabledEmailNotificationsSQL: makeEnabledNotifications(emailConfig),
  };
};
