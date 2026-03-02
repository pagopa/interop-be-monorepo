import z from "zod";
import {
  TenantNotificationConfigId,
  TenantId,
  UserNotificationConfigId,
  UserId,
} from "../brandedIds.js";
import { NotificationType } from "../notification/notification.js";
import { UserRole } from "../user/user.js";

const notificationConfigShape = Object.fromEntries(
  NotificationType.options.map((key) => [key, z.boolean()])
) as Record<(typeof NotificationType.options)[number], z.ZodBoolean>;

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
  userRoles: z.array(UserRole).nonempty(),
  inAppNotificationPreference: z.boolean(),
  emailNotificationPreference: z.boolean(),
  emailDigestPreference: z.boolean(),
  inAppConfig: NotificationConfig,
  emailConfig: NotificationConfig,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});
export type UserNotificationConfig = z.infer<typeof UserNotificationConfig>;
