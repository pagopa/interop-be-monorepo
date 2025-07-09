import {
  NotificationConfig,
  TenantNotificationConfig,
  UserNotificationConfig,
  dateToString,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigItemsSQL,
  UserNotificationConfigItemsSQL,
} from "pagopa-interop-readmodel-models";
import { TenantNotificationType, UserNotificationType } from "./utils.js";

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
  enabledNotificationsSQL: Array<{ notificationType: TenantNotificationType }>;
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
    enabledNotificationsSQL: TenantNotificationType.options
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
  enabledNotificationsSQL: Array<{ notificationType: UserNotificationType }>;
} => {
  void (rest satisfies Record<string, never>);

  return {
    userNotificationConfigSQL: {
      id,
      metadataVersion,
      userId,
      tenantId,
      createdAt: dateToString(createdAt),
      updatedAt: dateToString(updatedAt),
    },
    enabledNotificationsSQL: NotificationConfig.keyof()
      .options.flatMap((notificationType) => [
        ...(inAppConfig[notificationType]
          ? ([`${notificationType}.inApp`] as const)
          : []),
        ...(emailConfig[notificationType]
          ? ([`${notificationType}.email`] as const)
          : []),
      ])
      .map((notificationType) => ({
        notificationType,
        userNotificationConfigId: id,
        metadataVersion,
      })),
  };
};
