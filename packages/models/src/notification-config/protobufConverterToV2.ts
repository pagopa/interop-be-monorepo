import { NotificationTenantV2 } from "../gen/v2/notification-config/notification-config.js";
import { NotificationTenant } from "./notificationConfig.js";

export const toNotificationTenantV2 = (
  input: NotificationTenant
): NotificationTenantV2 => input;
