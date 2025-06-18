/* eslint-disable max-params */
import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  NotificationTenant,
  NotificationConfigEvent,
  toNotificationTenantV2,
} from "pagopa-interop-models";

export const toCreateEventNotificationTenantConfigUpdated = (
  streamId: string,
  version: number | undefined,
  notificationTenant: NotificationTenant,
  correlationId: CorrelationId
): CreateEvent<NotificationConfigEvent> => ({
  streamId,
  version,
  event: {
    type: "NotificationTenantConfigUpdated",
    event_version: 2,
    data: { notificationTenant: toNotificationTenantV2(notificationTenant) },
  },
  correlationId,
});
