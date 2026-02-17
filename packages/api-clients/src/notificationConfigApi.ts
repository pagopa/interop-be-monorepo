import { createNotificationConfigClient } from "./notificationConfigApi.heyapi.js";

export type NotificationConfigProcessClient = ReturnType<
  typeof createNotificationConfigClient
>;

export * from "./notificationConfigApi.heyapi.js";
