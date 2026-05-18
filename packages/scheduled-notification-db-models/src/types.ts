import { drizzle } from "drizzle-orm/node-postgres";

export const scheduledNotificationChannel = {
  inApp: "inApp",
  email: "email",
} as const;

export type ScheduledNotificationChannel =
  (typeof scheduledNotificationChannel)[keyof typeof scheduledNotificationChannel];

export const schedulableEventType = {
  eserviceArchivingScheduled: "EServiceArchivingScheduled",
  eserviceDescriptorArchivingScheduled: "EServiceDescriptorArchivingScheduled",
} as const;

export type SchedulableEventType =
  (typeof schedulableEventType)[keyof typeof schedulableEventType];

export type ScheduledNotificationDrizzleReturnType = ReturnType<typeof drizzle>;

export type ScheduledNotificationDrizzleTransactionType = Parameters<
  Parameters<ScheduledNotificationDrizzleReturnType["transaction"]>[0]
>[0];
