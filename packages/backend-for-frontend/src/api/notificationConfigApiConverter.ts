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
      clientKeyConsumerAddedDeletedToClientUsers,
      producerKeychainKeyAddedDeletedToClientUsers,
      purposeRiskAnalysisSignedToAdmin,
      purposeRiskAnalysisRejectedToAdmin,
      purposeRiskAnalysisAssignedForSigningToReviewer,
      purposeRiskAnalysisAssignedForWritingAndSigningToReviewer,
      purposeRiskAnalysisAssignmentRemovedToReviewer,
      draftPurposeDeletedWithRiskAnalysisToReviewer,
      purposeRiskAnalysisSignedToReviewer,
      ...rest
    } = config;

    return {
      ...rest,
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers:
        clientKeyAddedDeletedToClientUsers ||
        clientKeyConsumerAddedDeletedToClientUsers ||
        producerKeychainKeyAddedDeletedToClientUsers,
      purposeRiskAnalysisAssignmentStatusToAdmin:
        purposeRiskAnalysisSignedToAdmin || purposeRiskAnalysisRejectedToAdmin,
      purposeRiskAnalysisAssignmentStatusToReviewer:
        purposeRiskAnalysisAssignedForSigningToReviewer ||
        purposeRiskAnalysisAssignedForWritingAndSigningToReviewer ||
        purposeRiskAnalysisAssignmentRemovedToReviewer ||
        draftPurposeDeletedWithRiskAnalysisToReviewer ||
        purposeRiskAnalysisSignedToReviewer,
    };
  };

  return {
    inAppNotificationPreference:
      userNotificationConfig.inAppNotificationPreference,
    emailNotificationPreference:
      userNotificationConfig.emailNotificationPreference,
    emailDigestPreference: userNotificationConfig.emailDigestPreference,
    inAppConfig: mapNotificationConfig(userNotificationConfig.inAppConfig),
    emailConfig: mapNotificationConfig(userNotificationConfig.emailConfig),
  };
}

export function toNotificationConfigApiUserNotificationConfigUpdateSeed(
  seed: bffApi.UserNotificationConfigUpdateSeed
): notificationConfigApi.UserNotificationConfigUpdateSeed {
  const mapNotificationConfig = ({
    clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
    purposeRiskAnalysisAssignmentStatusToAdmin,
    purposeRiskAnalysisAssignmentStatusToReviewer,
    ...rest
  }: bffApi.NotificationConfig): notificationConfigApi.NotificationConfig => ({
    ...rest,
    clientKeyAddedDeletedToClientUsers:
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
    clientKeyConsumerAddedDeletedToClientUsers:
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
    producerKeychainKeyAddedDeletedToClientUsers:
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
    purposeRiskAnalysisSignedToAdmin:
      purposeRiskAnalysisAssignmentStatusToAdmin,
    purposeRiskAnalysisRejectedToAdmin:
      purposeRiskAnalysisAssignmentStatusToAdmin,
    purposeRiskAnalysisAssignedForSigningToReviewer:
      purposeRiskAnalysisAssignmentStatusToReviewer,
    purposeRiskAnalysisAssignedForWritingAndSigningToReviewer:
      purposeRiskAnalysisAssignmentStatusToReviewer,
    purposeRiskAnalysisAssignmentRemovedToReviewer:
      purposeRiskAnalysisAssignmentStatusToReviewer,
    draftPurposeDeletedWithRiskAnalysisToReviewer:
      purposeRiskAnalysisAssignmentStatusToReviewer,
    purposeRiskAnalysisSignedToReviewer:
      purposeRiskAnalysisAssignmentStatusToReviewer,
  });

  return {
    ...seed,
    inAppConfig: mapNotificationConfig(seed.inAppConfig),
    emailConfig: mapNotificationConfig(seed.emailConfig),
  };
}
