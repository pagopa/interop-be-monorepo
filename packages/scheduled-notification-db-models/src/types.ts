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
