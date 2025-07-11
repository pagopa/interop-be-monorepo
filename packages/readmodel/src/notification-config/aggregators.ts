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
  UserEnabledNotificationSQL,
  UserNotificationConfigItemsSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";
import { TenantNotificationType, UserNotificationType } from "./utils.js";

export const aggregateTenantNotificationConfig = ({
  tenantNotificationConfigSQL,
  enabledNotificationsSQL,
}: TenantNotificationConfigItemsSQL): WithMetadata<TenantNotificationConfig> => {
  const { id, metadataVersion, tenantId, createdAt, updatedAt, ...rest } =
    tenantNotificationConfigSQL;
  void (rest satisfies Record<string, never>);

  const enabledNotifications = enabledNotificationsSQL.map((r) =>
    TenantNotificationType.parse(r.notificationType)
  );

  const config: NotificationConfig = {
    newEServiceVersionPublished: enabledNotifications.includes(
      "newEServiceVersionPublished"
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
  enabledNotificationsSQL,
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

  const enabledNotifications = enabledNotificationsSQL.map((r) =>
    UserNotificationType.parse(r.notificationType)
  );

  const inAppConfig: NotificationConfig = {
    newEServiceVersionPublished: enabledNotifications.includes(
      "newEServiceVersionPublished.inApp"
    ),
  };
  const emailConfig: NotificationConfig = {
    newEServiceVersionPublished: enabledNotifications.includes(
      "newEServiceVersionPublished.email"
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
    enabledNotification: UserEnabledNotificationSQL | null;
  }>
): UserNotificationConfigItemsSQL => {
  const { userNotificationConfigsSQL, enabledNotificationsSQL } =
    toUserNotificationConfigAggregatorArray(queryRes);

  throwIfMultiple(userNotificationConfigsSQL, "user notification config");

  return {
    userNotificationConfigSQL: userNotificationConfigsSQL[0],
    enabledNotificationsSQL,
  };
};

export const toUserNotificationConfigAggregatorArray = (
  queryRes: Array<{
    userNotificationConfig: UserNotificationConfigSQL;
    enabledNotification: UserEnabledNotificationSQL | null;
  }>
): {
  userNotificationConfigsSQL: UserNotificationConfigSQL[];
  enabledNotificationsSQL: UserEnabledNotificationSQL[];
} => {
  const userNotificationConfigIdSet = new Set<string>();
  const userNotificationConfigsSQL: UserNotificationConfigSQL[] = [];

  const enabledNotificationIdSet = new Set<string>();
  const enabledNotificationsSQL: UserEnabledNotificationSQL[] = [];

  queryRes.forEach((row) => {
    const userNotificationConfigSQL = row.userNotificationConfig;
    if (!userNotificationConfigIdSet.has(userNotificationConfigSQL.id)) {
      userNotificationConfigIdSet.add(userNotificationConfigSQL.id);
      // eslint-disable-next-line functional/immutable-data
      userNotificationConfigsSQL.push(userNotificationConfigSQL);
    }

    const enabledNotificationSQL = row.enabledNotification;
    const enabledNotificationPK = enabledNotificationSQL
      ? makeUniqueKey([
          enabledNotificationSQL.userNotificationConfigId,
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
    userNotificationConfigsSQL,
    enabledNotificationsSQL,
  };
};
