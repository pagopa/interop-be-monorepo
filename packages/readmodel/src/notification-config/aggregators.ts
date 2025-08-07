import {
  NotificationConfig,
  stringToDate,
  TenantNotificationConfig,
  unsafeBrandId,
  UserNotificationConfig,
  WithMetadata,
} from "pagopa-interop-models";
import {
  TenantEnabledNotificationSQL,
  TenantNotificationConfigItemsSQL,
  TenantNotificationConfigSQL,
  UserEnabledInAppNotificationSQL,
  UserEnabledEmailNotificationSQL,
  UserNotificationConfigItemsSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";
import { NotificationType } from "./utils.js";

export const aggregateTenantNotificationConfig = ({
  tenantNotificationConfigSQL,
  enabledNotificationsSQL,
}: TenantNotificationConfigItemsSQL): WithMetadata<TenantNotificationConfig> => {
  const { id, metadataVersion, tenantId, createdAt, updatedAt, ...rest } =
    tenantNotificationConfigSQL;
  void (rest satisfies Record<string, never>);

  const enabledNotifications = enabledNotificationsSQL.map((r) =>
    NotificationType.parse(r.notificationType)
  );

  const config: NotificationConfig = {
    agreementSuspendedUnsuspendedToProducer: enabledNotifications.includes(
      "agreementSuspendedUnsuspendedToProducer"
    ),
    agreementManagementToProducer: enabledNotifications.includes(
      "agreementManagementToProducer"
    ),
    clientAddedRemovedToProducer: enabledNotifications.includes(
      "clientAddedRemovedToProducer"
    ),
    purposeStatusChangedToProducer: enabledNotifications.includes(
      "purposeStatusChangedToProducer"
    ),
    templateStatusChangedToProducer: enabledNotifications.includes(
      "templateStatusChangedToProducer"
    ),
    agreementSuspendedUnsuspendedToConsumer: enabledNotifications.includes(
      "agreementSuspendedUnsuspendedToConsumer"
    ),
    eserviceStatusChangedToConsumer: enabledNotifications.includes(
      "eserviceStatusChangedToConsumer"
    ),
    agreementActivatedRejectedToConsumer: enabledNotifications.includes(
      "agreementActivatedRejectedToConsumer"
    ),
    purposeVersionOverQuotaToConsumer: enabledNotifications.includes(
      "purposeVersionOverQuotaToConsumer"
    ),
    purposeActivatedRejectedToConsumer: enabledNotifications.includes(
      "purposeActivatedRejectedToConsumer"
    ),
    purposeSuspendedUnsuspendedToConsumer: enabledNotifications.includes(
      "purposeSuspendedUnsuspendedToConsumer"
    ),
    newEserviceTemplateVersionToInstantiator: enabledNotifications.includes(
      "newEserviceTemplateVersionToInstantiator"
    ),
    eserviceTemplateNameChangedToInstantiator: enabledNotifications.includes(
      "eserviceTemplateNameChangedToInstantiator"
    ),
    eserviceTemplateStatusChangedToInstantiator: enabledNotifications.includes(
      "eserviceTemplateStatusChangedToInstantiator"
    ),
    delegationApprovedRejectedToDelegator: enabledNotifications.includes(
      "delegationApprovedRejectedToDelegator"
    ),
    eserviceNewVersionSubmittedToDelegator: enabledNotifications.includes(
      "eserviceNewVersionSubmittedToDelegator"
    ),
    eserviceNewVersionApprovedRejectedToDelegate: enabledNotifications.includes(
      "eserviceNewVersionApprovedRejectedToDelegate"
    ),
    delegationSubmittedRevokedToDelegate: enabledNotifications.includes(
      "delegationSubmittedRevokedToDelegate"
    ),
    certifiedVerifiedAttributeAssignedRevokedToAssignee:
      enabledNotifications.includes(
        "certifiedVerifiedAttributeAssignedRevokedToAssignee"
      ),
    clientKeyStatusChangedToClientUsers: enabledNotifications.includes(
      "clientKeyStatusChangedToClientUsers"
    ),
  };

  return {
    data: {
      id: unsafeBrandId(id),
      tenantId: unsafeBrandId(tenantId),
      config,
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
    eserviceStatusChangedToConsumer: enabledInAppNotifications.includes(
      "eserviceStatusChangedToConsumer"
    ),
    agreementActivatedRejectedToConsumer: enabledInAppNotifications.includes(
      "agreementActivatedRejectedToConsumer"
    ),
    purposeVersionOverQuotaToConsumer: enabledInAppNotifications.includes(
      "purposeVersionOverQuotaToConsumer"
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
    clientKeyStatusChangedToClientUsers: enabledInAppNotifications.includes(
      "clientKeyStatusChangedToClientUsers"
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
    eserviceStatusChangedToConsumer: enabledEmailNotifications.includes(
      "eserviceStatusChangedToConsumer"
    ),
    agreementActivatedRejectedToConsumer: enabledEmailNotifications.includes(
      "agreementActivatedRejectedToConsumer"
    ),
    purposeVersionOverQuotaToConsumer: enabledEmailNotifications.includes(
      "purposeVersionOverQuotaToConsumer"
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
    clientKeyStatusChangedToClientUsers: enabledEmailNotifications.includes(
      "clientKeyStatusChangedToClientUsers"
    ),
  };

  return {
    data: {
      id: unsafeBrandId(id),
      userId: unsafeBrandId(userId),
      tenantId: unsafeBrandId(tenantId),
      inAppConfig,
      emailConfig,
      createdAt: stringToDate(createdAt),
      ...(updatedAt ? { updatedAt: stringToDate(updatedAt) } : {}),
    },
    metadata: { version: metadataVersion },
  };
};

export const toTenantNotificationConfigAggregator = (
  queryRes: Array<{
    tenantNotificationConfig: TenantNotificationConfigSQL;
    enabledNotification: TenantEnabledNotificationSQL | null;
  }>
): TenantNotificationConfigItemsSQL => {
  const { tenantNotificationConfigsSQL, enabledNotificationsSQL } =
    toTenantNotificationConfigAggregatorArray(queryRes);

  throwIfMultiple(tenantNotificationConfigsSQL, "tenant notification config");

  return {
    tenantNotificationConfigSQL: tenantNotificationConfigsSQL[0],
    enabledNotificationsSQL,
  };
};

export const toTenantNotificationConfigAggregatorArray = (
  queryRes: Array<{
    tenantNotificationConfig: TenantNotificationConfigSQL;
    enabledNotification: TenantEnabledNotificationSQL | null;
  }>
): {
  tenantNotificationConfigsSQL: TenantNotificationConfigSQL[];
  enabledNotificationsSQL: TenantEnabledNotificationSQL[];
} => {
  const tenantNotificationConfigIdSet = new Set<string>();
  const tenantNotificationConfigsSQL: TenantNotificationConfigSQL[] = [];

  const enabledNotificationIdSet = new Set<string>();
  const enabledNotificationsSQL: TenantEnabledNotificationSQL[] = [];

  queryRes.forEach((row) => {
    const tenantNotificationConfigSQL = row.tenantNotificationConfig;
    if (!tenantNotificationConfigIdSet.has(tenantNotificationConfigSQL.id)) {
      tenantNotificationConfigIdSet.add(tenantNotificationConfigSQL.id);
      // eslint-disable-next-line functional/immutable-data
      tenantNotificationConfigsSQL.push(tenantNotificationConfigSQL);
    }

    const enabledNotificationSQL = row.enabledNotification;
    const enabledNotificationPK = enabledNotificationSQL
      ? makeUniqueKey([
          enabledNotificationSQL.tenantNotificationConfigId,
          enabledNotificationSQL.notificationType,
        ])
      : undefined;
    if (
      enabledNotificationSQL &&
      enabledNotificationPK &&
      !enabledNotificationIdSet.has(enabledNotificationPK)
    ) {
      enabledNotificationIdSet.add(enabledNotificationPK);
      // eslint-disable-next-line functional/immutable-data
      enabledNotificationsSQL.push(enabledNotificationSQL);
    }
  });

  return {
    tenantNotificationConfigsSQL,
    enabledNotificationsSQL,
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
