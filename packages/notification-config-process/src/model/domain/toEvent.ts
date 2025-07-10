/* eslint-disable max-params */
import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  NotificationConfigEvent,
  toTenantNotificationConfigV2,
  toUserNotificationConfigV2,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";

export const toCreateEventTenantNotificationConfigUpdated = (
  streamId: string,
  version: number | undefined,
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
  version: number | undefined,
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
