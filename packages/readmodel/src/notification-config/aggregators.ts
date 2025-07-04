import {
  stringToDate,
  TenantNotificationConfig,
  unsafeBrandId,
  UserNotificationConfig,
  WithMetadata,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";

export const aggregateTenantNotificationConfig = ({
  id,
  metadataVersion,
  tenantId,
  createdAt,
  updatedAt,
  newEserviceVersionPublished,
  ...rest
}: TenantNotificationConfigSQL): WithMetadata<TenantNotificationConfig> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      id: unsafeBrandId(id),
      tenantId: unsafeBrandId(tenantId),
      config: { newEServiceVersionPublished: newEserviceVersionPublished },
      createdAt: stringToDate(createdAt),
      ...(updatedAt ? { updatedAt: stringToDate(updatedAt) } : {}),
    },
    metadata: { version: metadataVersion },
  };
};

export const aggregateUserNotificationConfig = ({
  id,
  metadataVersion,
  tenantId,
  userId,
  createdAt,
  updatedAt,
  newEserviceVersionPublishedInApp,
  newEserviceVersionPublishedEmail,
  ...rest
}: UserNotificationConfigSQL): WithMetadata<UserNotificationConfig> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      id: unsafeBrandId(id),
      userId: unsafeBrandId(userId),
      tenantId: unsafeBrandId(tenantId),
      inAppConfig: {
        newEServiceVersionPublished: newEserviceVersionPublishedInApp,
      },
      emailConfig: {
        newEServiceVersionPublished: newEserviceVersionPublishedEmail,
      },
      createdAt: stringToDate(createdAt),
      ...(updatedAt ? { updatedAt: stringToDate(updatedAt) } : {}),
    },
    metadata: { version: metadataVersion },
  };
};
