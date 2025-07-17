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
    newEServiceVersionPublished: enabledInAppNotifications.includes(
      "newEServiceVersionPublished"
    ),
  };
  const emailConfig: NotificationConfig = {
    newEServiceVersionPublished: enabledEmailNotifications.includes(
      "newEServiceVersionPublished"
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
  const tenantNotificationConfigsSQL: TenantNotificationConfigSQL[] =
    collectUnique(
      queryRes.map((row) => row.tenantNotificationConfig),
      (row) => row.id
    );
  const enabledNotificationsSQL: TenantEnabledNotificationSQL[] = collectUnique(
    queryRes.map((row) => row.enabledNotification),
    (row) =>
      makeUniqueKey([row.tenantNotificationConfigId, row.notificationType])
  );
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
  const userNotificationConfigsSQL: UserNotificationConfigSQL[] = collectUnique(
    queryRes.map((row) => row.userNotificationConfig),
    (row) => row.id
  );
  const enabledInAppNotificationsSQL: UserEnabledInAppNotificationSQL[] =
    collectUnique(
      queryRes.map((row) => row.enabledInAppNotification),
      (row) =>
        makeUniqueKey([row.userNotificationConfigId, row.notificationType])
    );
  const enabledEmailNotificationsSQL: UserEnabledEmailNotificationSQL[] =
    collectUnique(
      queryRes.map((row) => row.enabledEmailNotification),
      (row) =>
        makeUniqueKey([row.userNotificationConfigId, row.notificationType])
    );

  return {
    userNotificationConfigsSQL,
    enabledInAppNotificationsSQL,
    enabledEmailNotificationsSQL,
  };
};

const collectUnique = <T>(
  rows: Array<T | null>,
  getId: (row: T) => string
): T[] => {
  const uniqueRows: T[] = [];
  const idSet = new Set<string>();

  rows.forEach((row) => {
    if (row) {
      const id = getId(row);
      if (!idSet.has(id)) {
        idSet.add(id);
        // eslint-disable-next-line functional/immutable-data
        uniqueRows.push(row);
      }
    }
  });

  return uniqueRows;
};
