/* eslint-disable max-params */
import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  NotificationConfigEvent,
  toTenantNotificationConfigV2,
  toUserNotificationConfigV2,
  TenantNotificationConfig,
  UserNotificationConfig,
  UserRole,
  toUserRoleV2,
} from "pagopa-interop-models";

export const toCreateEventTenantNotificationConfigCreated = (
  streamId: string,
  tenantNotificationConfig: TenantNotificationConfig,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version: undefined,
  event: {
    type: "TenantNotificationConfigCreated",
    event_version: 2,
    data: {
      tenantNotificationConfig: toTenantNotificationConfigV2(
        tenantNotificationConfig
      ),
    },
  },
  correlationId,
});

export const toCreateEventUserNotificationConfigCreated = (
  streamId: string,
  userNotificationConfig: UserNotificationConfig,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version: undefined,
  event: {
    type: "UserNotificationConfigCreated",
    event_version: 2,
    data: {
      userNotificationConfig: toUserNotificationConfigV2(
        userNotificationConfig
      ),
    },
  },
  correlationId,
});

export const toCreateEventTenantNotificationConfigUpdated = (
  streamId: string,
  version: number,
  tenantNotificationConfig: TenantNotificationConfig,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "TenantNotificationConfigUpdated",
    event_version: 2,
    data: {
      tenantNotificationConfig: toTenantNotificationConfigV2(
        tenantNotificationConfig
      ),
    },
  },
  correlationId,
});

export const toCreateEventUserNotificationConfigUpdated = (
  streamId: string,
  version: number,
  userNotificationConfig: UserNotificationConfig,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "UserNotificationConfigUpdated",
    event_version: 2,
    data: {
      userNotificationConfig: toUserNotificationConfigV2(
        userNotificationConfig
      ),
    },
  },
  correlationId,
});

export const toCreateEventTenantNotificationConfigDeleted = (
  streamId: string,
  version: number,
  tenantNotificationConfig: TenantNotificationConfig,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "TenantNotificationConfigDeleted",
    event_version: 2,
    data: {
      tenantNotificationConfig: toTenantNotificationConfigV2(
        tenantNotificationConfig
      ),
    },
  },
  correlationId,
});

export const toCreateEventUserNotificationConfigDeleted = (
  streamId: string,
  version: number,
  userNotificationConfig: UserNotificationConfig,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "UserNotificationConfigDeleted",
    event_version: 2,
    data: {
      userNotificationConfig: toUserNotificationConfigV2(
        userNotificationConfig
      ),
    },
  },
  correlationId,
});

export const toCreateEventUserNotificationConfigRoleAdded = (
  streamId: string,
  version: number,
  userNotificationConfig: UserNotificationConfig,
  userRole: UserRole,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "UserNotificationConfigRoleAdded",
    event_version: 2,
    data: {
      userNotificationConfig: toUserNotificationConfigV2(
        userNotificationConfig
      ),
      userRole: toUserRoleV2(userRole),
    },
  },
  correlationId,
});

export const toCreateEventUserNotificationConfigRoleRemoved = (
  streamId: string,
  version: number,
  userNotificationConfig: UserNotificationConfig,
  userRole: UserRole,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "UserNotificationConfigRoleRemoved",
    event_version: 2,
    data: {
      userNotificationConfig: toUserNotificationConfigV2(
        userNotificationConfig
      ),
      userRole: toUserRoleV2(userRole),
    },
  },
  correlationId,
});
