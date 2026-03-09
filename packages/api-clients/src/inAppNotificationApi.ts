import * as inAppNotificationApi from "./generated/inAppNotificationApi.js";

export type InAppNotificationManagerClient = ReturnType<
  typeof inAppNotificationApi.createNotificationApiClient
>;

export * from "./generated/inAppNotificationApi.js";
