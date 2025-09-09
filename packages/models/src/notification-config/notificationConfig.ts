import z from "zod";
import {
  TenantNotificationConfigId,
  TenantId,
  UserNotificationConfigId,
  UserId,
} from "../brandedIds.js";
import { NotificationType } from "../notification/notification.js";

// Shared notification config keys definition

// Dynamically create NotificationConfig with boolean values for each key
const notificationConfigShape = Object.fromEntries(
  NotificationType.options.map((key) => [key, z.boolean()])
) as { [K in (typeof NotificationType.options)[number]]: z.ZodBoolean };

export const NotificationConfig = z.object(notificationConfigShape);
export type NotificationConfig = z.infer<typeof NotificationConfig>;

export const TenantNotificationConfig = z.object({
  id: TenantNotificationConfigId,
  tenantId: TenantId,
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});
export type TenantNotificationConfig = z.infer<typeof TenantNotificationConfig>;

export const UserNotificationConfig = z.object({
  id: UserNotificationConfigId,
  userId: UserId,
  tenantId: TenantId,
  inAppConfig: NotificationConfig,
  emailConfig: NotificationConfig,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});
export type UserNotificationConfig = z.infer<typeof UserNotificationConfig>;

export const NotificationListResult = z.object({
  results: z.array(z.string().uuid()),
  totalCount: z.number(),
});
export type NotificationListResult = z.infer<typeof NotificationListResult>;

// Dynamically create an object with the same keys as NotificationConfig but with ListResult values
const notificationsByTypeResults = Object.fromEntries(
  NotificationType.options.map((key) => [key, NotificationListResult])
) as {
  [K in (typeof NotificationType.options)[number]]: typeof NotificationListResult;
};

export const NotificationsByType = z.object({
  results: z.object(notificationsByTypeResults),
  totalCount: z.number(),
});
export type NotificationsByType = z.infer<typeof NotificationsByType>;
