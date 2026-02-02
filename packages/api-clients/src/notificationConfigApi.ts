import * as notificationConfigApi from "./generated/notificationConfigApi.js";

export type NotificationConfigProcessClient = ReturnType<
  typeof notificationConfigApi.createProcessApiClient
>;

export * from "./generated/notificationConfigApi.js";
