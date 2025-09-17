import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";

export function toBffApiTenantNotificationConfig(
  tenantNotificationConfig: notificationConfigApi.TenantNotificationConfig
): bffApi.TenantNotificationConfig {
  return {
    enabled: tenantNotificationConfig.enabled,
  };
}

export function toBffApiUserNotificationConfig(
  userNotificationConfig: notificationConfigApi.UserNotificationConfig
): bffApi.UserNotificationConfig {
  return {
    inAppConfig: userNotificationConfig.inAppConfig,
    emailConfig: userNotificationConfig.emailConfig,
  };
}
