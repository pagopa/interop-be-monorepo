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
  const mapNotificationConfig = (
    config: notificationConfigApi.NotificationConfig
  ): bffApi.NotificationConfig => {
    const {
      clientKeyAddedDeletedToClientUsers,
      producerKeychainKeyAddedDeletedToClientUsers,
      ...rest
    } = config;

    return {
      ...rest,
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers:
        clientKeyAddedDeletedToClientUsers ||
        producerKeychainKeyAddedDeletedToClientUsers,
    };
  };

  return {
    inAppNotificationPreference:
      userNotificationConfig.inAppNotificationPreference,
    emailNotificationPreference:
      userNotificationConfig.emailNotificationPreference,
    inAppConfig: mapNotificationConfig(userNotificationConfig.inAppConfig),
    emailConfig: mapNotificationConfig(userNotificationConfig.emailConfig),
  };
}
