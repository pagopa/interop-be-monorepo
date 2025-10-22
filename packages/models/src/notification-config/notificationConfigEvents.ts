import { z } from "zod";
import { match } from "ts-pattern";

import {
  TenantNotificationConfigCreatedV2,
  TenantNotificationConfigUpdatedV2,
  TenantNotificationConfigDeletedV2,
  UserNotificationConfigCreatedV2,
  UserNotificationConfigUpdatedV2,
  UserNotificationConfigDeletedV2,
  UserNotificationConfigRoleAddedV2,
  UserNotificationConfigRoleRemovedV2,
} from "../gen/v2/notification-config/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export const NotificationConfigEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantNotificationConfigCreated"),
    data: protobufDecoder(TenantNotificationConfigCreatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantNotificationConfigUpdated"),
    data: protobufDecoder(TenantNotificationConfigUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("TenantNotificationConfigDeleted"),
    data: protobufDecoder(TenantNotificationConfigDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("UserNotificationConfigCreated"),
    data: protobufDecoder(UserNotificationConfigCreatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("UserNotificationConfigUpdated"),
    data: protobufDecoder(UserNotificationConfigUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("UserNotificationConfigDeleted"),
    data: protobufDecoder(UserNotificationConfigDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("UserNotificationConfigRoleAdded"),
    data: protobufDecoder(UserNotificationConfigRoleAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("UserNotificationConfigRoleRemoved"),
    data: protobufDecoder(UserNotificationConfigRoleRemovedV2),
  }),
]);

export type NotificationConfigEventV2 = z.infer<
  typeof NotificationConfigEventV2
>;

export function notificationConfigEventToBinaryDataV2(
  event: NotificationConfigEventV2
): Uint8Array {
  return match(event)
    .with({ type: "TenantNotificationConfigCreated" }, ({ data }) =>
      TenantNotificationConfigCreatedV2.toBinary(data)
    )
    .with({ type: "TenantNotificationConfigUpdated" }, ({ data }) =>
      TenantNotificationConfigUpdatedV2.toBinary(data)
    )
    .with({ type: "TenantNotificationConfigDeleted" }, ({ data }) =>
      TenantNotificationConfigDeletedV2.toBinary(data)
    )
    .with({ type: "UserNotificationConfigCreated" }, ({ data }) =>
      UserNotificationConfigCreatedV2.toBinary(data)
    )
    .with({ type: "UserNotificationConfigUpdated" }, ({ data }) =>
      UserNotificationConfigUpdatedV2.toBinary(data)
    )
    .with({ type: "UserNotificationConfigDeleted" }, ({ data }) =>
      UserNotificationConfigDeletedV2.toBinary(data)
    )
    .with({ type: "UserNotificationConfigRoleAdded" }, ({ data }) =>
      UserNotificationConfigRoleAddedV2.toBinary(data)
    )
    .with({ type: "UserNotificationConfigRoleRemoved" }, ({ data }) =>
      UserNotificationConfigRoleRemovedV2.toBinary(data)
    )
    .exhaustive();
}

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const NotificationConfigEvent = z
  .discriminatedUnion("event_version", [eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 2 }, () =>
        NotificationConfigEventV2.safeParse(obj)
      )
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type NotificationConfigEvent = z.infer<typeof NotificationConfigEvent>;

export const NotificationConfigEventEnvelopeV2 = EventEnvelope(
  NotificationConfigEventV2
);
export type NotificationConfigEventEnvelopeV2 = z.infer<
  typeof NotificationConfigEventEnvelopeV2
>;

export const NotificationConfigEventEnvelope = EventEnvelope(
  NotificationConfigEvent
);
export type NotificationConfigEventEnvelope = z.infer<
  typeof NotificationConfigEventEnvelope
>;
