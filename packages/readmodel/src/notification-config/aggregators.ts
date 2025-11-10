import {
  EmailNotificationPreference,
  NotificationConfig,
  NotificationType,
  stringToDate,
  TenantNotificationConfig,
  unsafeBrandId,
  UserNotificationConfig,
  WithMetadata,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigSQL,
  UserEnabledInAppNotificationSQL,
  UserEnabledEmailNotificationSQL,
  UserNotificationConfigItemsSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregateTenantNotificationConfig = (
  tenantNotificationConfigSQL: TenantNotificationConfigSQL
): WithMetadata<TenantNotificationConfig> => {
  const {
    id,
    metadataVersion,
    tenantId,
    enabled,
    createdAt,
    updatedAt,
    ...rest
  } = tenantNotificationConfigSQL;
  void (rest satisfies Record<string, never>);

  return {
    data: {
      id: unsafeBrandId(id),
      tenantId: unsafeBrandId(tenantId),
      enabled,
      createdAt: stringToDate(createdAt),
      ...(updatedAt ? { updatedAt: stringToDate(updatedAt) } : {}),
    },
    metadata: { version: metadataVersion },
  };
};

export const aggregateUserNotificationConfig = ({
  userNotificationConfigSQL,
  enabledInAppNotificationsSQL,
  enabledEmailNotificationsSQL,
}: UserNotificationConfigItemsSQL): WithMetadata<UserNotificationConfig> => {
  const {
    id,
    metadataVersion,
    userId,
    tenantId,
    userRoles: userRolesSQL,
    inAppNotificationPreference,
    emailNotificationPreference,
    createdAt,
    updatedAt,
    ...rest
  } = userNotificationConfigSQL;
  void (rest satisfies Record<string, never>);

  const enabledInAppNotifications = enabledInAppNotificationsSQL.map((r) =>
    NotificationType.parse(r.notificationType)
  );
  const enabledEmailNotifications = enabledEmailNotificationsSQL.map((r) =>
    NotificationType.parse(r.notificationType)
  );
  const userRoles = UserNotificationConfig.shape.userRoles.parse(userRolesSQL);

  const inAppConfig: NotificationConfig = {
    agreementSuspendedUnsuspendedToProducer: enabledInAppNotifications.includes(
      "agreementSuspendedUnsuspendedToProducer"
    ),
    agreementManagementToProducer: enabledInAppNotifications.includes(
      "agreementManagementToProducer"
    ),
    clientAddedRemovedToProducer: enabledInAppNotifications.includes(
      "clientAddedRemovedToProducer"
    ),
    purposeStatusChangedToProducer: enabledInAppNotifications.includes(
      "purposeStatusChangedToProducer"
    ),
    templateStatusChangedToProducer: enabledInAppNotifications.includes(
      "templateStatusChangedToProducer"
    ),
    agreementSuspendedUnsuspendedToConsumer: enabledInAppNotifications.includes(
      "agreementSuspendedUnsuspendedToConsumer"
    ),
    eserviceStateChangedToConsumer: enabledInAppNotifications.includes(
      "eserviceStateChangedToConsumer"
    ),
    agreementActivatedRejectedToConsumer: enabledInAppNotifications.includes(
      "agreementActivatedRejectedToConsumer"
    ),
    purposeActivatedRejectedToConsumer: enabledInAppNotifications.includes(
      "purposeActivatedRejectedToConsumer"
    ),
    purposeSuspendedUnsuspendedToConsumer: enabledInAppNotifications.includes(
      "purposeSuspendedUnsuspendedToConsumer"
    ),
    newEserviceTemplateVersionToInstantiator:
      enabledInAppNotifications.includes(
        "newEserviceTemplateVersionToInstantiator"
      ),
    eserviceTemplateNameChangedToInstantiator:
      enabledInAppNotifications.includes(
        "eserviceTemplateNameChangedToInstantiator"
      ),
    eserviceTemplateStatusChangedToInstantiator:
      enabledInAppNotifications.includes(
        "eserviceTemplateStatusChangedToInstantiator"
      ),
    delegationApprovedRejectedToDelegator: enabledInAppNotifications.includes(
      "delegationApprovedRejectedToDelegator"
    ),
    eserviceNewVersionSubmittedToDelegator: enabledInAppNotifications.includes(
      "eserviceNewVersionSubmittedToDelegator"
    ),
    eserviceNewVersionApprovedRejectedToDelegate:
      enabledInAppNotifications.includes(
        "eserviceNewVersionApprovedRejectedToDelegate"
      ),
    delegationSubmittedRevokedToDelegate: enabledInAppNotifications.includes(
      "delegationSubmittedRevokedToDelegate"
    ),
    certifiedVerifiedAttributeAssignedRevokedToAssignee:
      enabledInAppNotifications.includes(
        "certifiedVerifiedAttributeAssignedRevokedToAssignee"
      ),
    clientKeyAddedDeletedToClientUsers: enabledInAppNotifications.includes(
      "clientKeyAddedDeletedToClientUsers"
    ),
    producerKeychainKeyAddedDeletedToClientUsers:
      enabledInAppNotifications.includes(
        "producerKeychainKeyAddedDeletedToClientUsers"
      ),
    purposeQuotaAdjustmentRequestToProducer: enabledInAppNotifications.includes(
      "purposeQuotaAdjustmentRequestToProducer"
    ),
    purposeQuotaOverthresholdStateToConsumer: enabledInAppNotifications.includes(
      "purposeQuotaOverthresholdStateToConsumer"
    ),
  };
  const emailConfig: NotificationConfig = {
    agreementSuspendedUnsuspendedToProducer: enabledEmailNotifications.includes(
      "agreementSuspendedUnsuspendedToProducer"
    ),
    agreementManagementToProducer: enabledEmailNotifications.includes(
      "agreementManagementToProducer"
    ),
    clientAddedRemovedToProducer: enabledEmailNotifications.includes(
      "clientAddedRemovedToProducer"
    ),
    purposeStatusChangedToProducer: enabledEmailNotifications.includes(
      "purposeStatusChangedToProducer"
    ),
    templateStatusChangedToProducer: enabledEmailNotifications.includes(
      "templateStatusChangedToProducer"
    ),
    agreementSuspendedUnsuspendedToConsumer: enabledEmailNotifications.includes(
      "agreementSuspendedUnsuspendedToConsumer"
    ),
    eserviceStateChangedToConsumer: enabledEmailNotifications.includes(
      "eserviceStateChangedToConsumer"
    ),
    agreementActivatedRejectedToConsumer: enabledEmailNotifications.includes(
      "agreementActivatedRejectedToConsumer"
    ),
    purposeActivatedRejectedToConsumer: enabledEmailNotifications.includes(
      "purposeActivatedRejectedToConsumer"
    ),
    purposeSuspendedUnsuspendedToConsumer: enabledEmailNotifications.includes(
      "purposeSuspendedUnsuspendedToConsumer"
    ),
    newEserviceTemplateVersionToInstantiator:
      enabledEmailNotifications.includes(
        "newEserviceTemplateVersionToInstantiator"
      ),
    eserviceTemplateNameChangedToInstantiator:
      enabledEmailNotifications.includes(
        "eserviceTemplateNameChangedToInstantiator"
      ),
    eserviceTemplateStatusChangedToInstantiator:
      enabledEmailNotifications.includes(
        "eserviceTemplateStatusChangedToInstantiator"
      ),
    delegationApprovedRejectedToDelegator: enabledEmailNotifications.includes(
      "delegationApprovedRejectedToDelegator"
    ),
    eserviceNewVersionSubmittedToDelegator: enabledEmailNotifications.includes(
      "eserviceNewVersionSubmittedToDelegator"
    ),
    eserviceNewVersionApprovedRejectedToDelegate:
      enabledEmailNotifications.includes(
        "eserviceNewVersionApprovedRejectedToDelegate"
      ),
    delegationSubmittedRevokedToDelegate: enabledEmailNotifications.includes(
      "delegationSubmittedRevokedToDelegate"
    ),
    certifiedVerifiedAttributeAssignedRevokedToAssignee:
      enabledEmailNotifications.includes(
        "certifiedVerifiedAttributeAssignedRevokedToAssignee"
      ),
    clientKeyAddedDeletedToClientUsers: enabledEmailNotifications.includes(
      "clientKeyAddedDeletedToClientUsers"
    ),
    producerKeychainKeyAddedDeletedToClientUsers:
      enabledEmailNotifications.includes(
        "producerKeychainKeyAddedDeletedToClientUsers"
      ),
    purposeQuotaAdjustmentRequestToProducer: enabledEmailNotifications.includes(
      "purposeQuotaAdjustmentRequestToProducer"
    ),
    purposeQuotaOverthresholdStateToConsumer: enabledEmailNotifications.includes(
      "purposeQuotaOverthresholdStateToConsumer"
    ),
  };

  return {
    data: {
      id: unsafeBrandId(id),
      userId: unsafeBrandId(userId),
      tenantId: unsafeBrandId(tenantId),
      userRoles,
      inAppNotificationPreference,
      emailNotificationPreference: EmailNotificationPreference.parse(
        emailNotificationPreference
      ),
      inAppConfig,
      emailConfig,
      createdAt: stringToDate(createdAt),
      ...(updatedAt ? { updatedAt: stringToDate(updatedAt) } : {}),
    },
    metadata: { version: metadataVersion },
  };
};

export const toUserNotificationConfigAggregator = (
  queryRes: Array<{
    userNotificationConfig: UserNotificationConfigSQL;
    enabledInAppNotification: UserEnabledInAppNotificationSQL | null;
    enabledEmailNotification: UserEnabledEmailNotificationSQL | null;
  }>
): UserNotificationConfigItemsSQL => {
  const {
    userNotificationConfigsSQL,
    enabledInAppNotificationsSQL,
    enabledEmailNotificationsSQL,
  } = toUserNotificationConfigAggregatorArray(queryRes);

  throwIfMultiple(userNotificationConfigsSQL, "user notification config");

  return {
    userNotificationConfigSQL: userNotificationConfigsSQL[0],
    enabledInAppNotificationsSQL,
    enabledEmailNotificationsSQL,
  };
};

export const toUserNotificationConfigAggregatorArray = (
  queryRes: Array<{
    userNotificationConfig: UserNotificationConfigSQL;
    enabledInAppNotification: UserEnabledInAppNotificationSQL | null;
    enabledEmailNotification: UserEnabledEmailNotificationSQL | null;
  }>
): {
  userNotificationConfigsSQL: UserNotificationConfigSQL[];
  enabledInAppNotificationsSQL: UserEnabledInAppNotificationSQL[];
  enabledEmailNotificationsSQL: UserEnabledEmailNotificationSQL[];
} => {
  const userNotificationConfigIdSet = new Set<string>();
  const userNotificationConfigsSQL: UserNotificationConfigSQL[] = [];

  const enabledInAppNotificationIdSet = new Set<string>();
  const enabledInAppNotificationsSQL: UserEnabledInAppNotificationSQL[] = [];

  const enabledEmailNotificationIdSet = new Set<string>();
  const enabledEmailNotificationsSQL: UserEnabledEmailNotificationSQL[] = [];

  queryRes.forEach((row) => {
    const userNotificationConfigSQL = row.userNotificationConfig;
    if (!userNotificationConfigIdSet.has(userNotificationConfigSQL.id)) {
      userNotificationConfigIdSet.add(userNotificationConfigSQL.id);
      // eslint-disable-next-line functional/immutable-data
      userNotificationConfigsSQL.push(userNotificationConfigSQL);
    }

    const enabledInAppNotificationSQL = row.enabledInAppNotification;
    const enabledInAppNotificationPK = enabledInAppNotificationSQL
      ? makeUniqueKey([
          enabledInAppNotificationSQL.userNotificationConfigId,
          enabledInAppNotificationSQL.notificationType,
        ])
      : undefined;
    if (
      enabledInAppNotificationSQL &&
      enabledInAppNotificationPK &&
      !enabledInAppNotificationIdSet.has(enabledInAppNotificationPK)
    ) {
      enabledInAppNotificationIdSet.add(enabledInAppNotificationPK);
      // eslint-disable-next-line functional/immutable-data
      enabledInAppNotificationsSQL.push(enabledInAppNotificationSQL);
    }

    const enabledEmailNotificationSQL = row.enabledEmailNotification;
    const enabledEmailNotificationPK = enabledEmailNotificationSQL
      ? makeUniqueKey([
          enabledEmailNotificationSQL.userNotificationConfigId,
          enabledEmailNotificationSQL.notificationType,
        ])
      : undefined;
    if (
      enabledEmailNotificationSQL &&
      enabledEmailNotificationPK &&
      !enabledEmailNotificationIdSet.has(enabledEmailNotificationPK)
    ) {
      enabledEmailNotificationIdSet.add(enabledEmailNotificationPK);
      // eslint-disable-next-line functional/immutable-data
      enabledEmailNotificationsSQL.push(enabledEmailNotificationSQL);
    }
  });

  return {
    userNotificationConfigsSQL,
    enabledInAppNotificationsSQL,
    enabledEmailNotificationsSQL,
  };
};
