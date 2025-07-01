import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";

export const splitTenantNotificationConfigIntoObjectsSQL = (
  {
    id,
    tenantId,
    config: {
      newEServiceVersionPublished: newEserviceVersionPublished,
      ...configRest
    },
    ...rest
  }: TenantNotificationConfig,
  metadataVersion: number
): TenantNotificationConfigSQL => {
  void (rest satisfies Record<string, never>);
  void (configRest satisfies Record<string, never>);
  return {
    id,
    metadataVersion,
    tenantId,
    newEserviceVersionPublished,
  };
};

export const splitUserNotificationConfigIntoObjectsSQL = (
  {
    id,
    userId,
    tenantId,
    inAppConfig: {
      newEServiceVersionPublished: newEserviceVersionPublishedInApp,
      ...inAppConfigRest
    },
    emailConfig: {
      newEServiceVersionPublished: newEserviceVersionPublishedEmail,
      ...emailConfigRest
    },
    ...rest
  }: UserNotificationConfig,
  metadataVersion: number
): UserNotificationConfigSQL => {
  void (rest satisfies Record<string, never>);
  void (inAppConfigRest satisfies Record<string, never>);
  void (emailConfigRest satisfies Record<string, never>);
  return {
    id,
    metadataVersion,
    userId,
    tenantId,
    newEserviceVersionPublishedInApp,
    newEserviceVersionPublishedEmail,
  };
};
