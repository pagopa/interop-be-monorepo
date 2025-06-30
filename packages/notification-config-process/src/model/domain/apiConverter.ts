import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";

export function tenantNotificationConfigToApiTenantNotificationConfig(
  input: TenantNotificationConfig
): notificationConfigApi.TenantNotificationConfig {
  return {
    id: input.id,
    tenantId: input.tenantId,
    config: {
      newEServiceVersionPublished: input.config.newEServiceVersionPublished,
    },
    createdAt: input.createdAt.toJSON(),
    updatedAt: input.updatedAt?.toJSON(),
  };
}

export function userNotificationConfigToApiUserNotificationConfig(
  input: UserNotificationConfig
): notificationConfigApi.UserNotificationConfig {
  return {
    id: input.id,
    userId: input.userId,
    tenantId: input.tenantId,
    inAppConfig: {
      newEServiceVersionPublished:
        input.inAppConfig.newEServiceVersionPublished,
    },
    emailConfig: {
      newEServiceVersionPublished:
        input.emailConfig.newEServiceVersionPublished,
    },
    createdAt: input.createdAt.toJSON(),
    updatedAt: input.updatedAt?.toJSON(),
  };
}
