import {
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
  newEserviceVersionPublished,
  ...rest
}: TenantNotificationConfigSQL): WithMetadata<TenantNotificationConfig> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      id: unsafeBrandId(id),
      tenantId: unsafeBrandId(tenantId),
      config: { newEServiceVersionPublished: newEserviceVersionPublished },
    },
    metadata: { version: metadataVersion },
  };
};

export const aggregateUserNotificationConfig = ({
  id,
  metadataVersion,
  tenantId,
  userId,
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
    },
    metadata: { version: metadataVersion },
  };
};
