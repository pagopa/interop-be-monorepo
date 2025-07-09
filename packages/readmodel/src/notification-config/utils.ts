import { z } from "zod";
import { NotificationConfig } from "pagopa-interop-models";

export const TenantNotificationType = NotificationConfig.keyof();
export type TenantNotificationType = z.infer<typeof TenantNotificationType>;

const userNotificationTypes = TenantNotificationType.options.flatMap((t) => [
  `${t}.inApp`,
  `${t}.email`,
]) as Array<`${keyof NotificationConfig}.${"inApp" | "email"}`>;

export const UserNotificationType = z.enum([
  Object.values(userNotificationTypes)[0],
  ...Object.values(userNotificationTypes).slice(1),
]);
export type UserNotificationType = z.infer<typeof UserNotificationType>;
