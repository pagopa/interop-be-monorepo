import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantEnabledNotificationInReadmodelNotificationConfig,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledInAppNotificationInReadmodelNotificationConfig,
  userEnabledEmailNotificationInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "./notification-config/splitters.js";

export const insertTenantNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  tenantNotificationConfig: TenantNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  const { tenantNotificationConfigSQL, enabledNotificationsSQL } =
    splitTenantNotificationConfigIntoObjectsSQL(
      tenantNotificationConfig,
      metadataVersion
    );

  await readModelDB.transaction(async (tx) => {
    await tx
      .insert(tenantNotificationConfigInReadmodelNotificationConfig)
      .values(tenantNotificationConfigSQL);
    if (enabledNotificationsSQL.length > 0) {
      await tx
        .insert(tenantEnabledNotificationInReadmodelNotificationConfig)
        .values(enabledNotificationsSQL);
    }
  });
};

export const insertUserNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  userNotificationConfig: UserNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  const {
    userNotificationConfigSQL,
    enabledInAppNotificationsSQL,
    enabledEmailNotificationsSQL,
  } = splitUserNotificationConfigIntoObjectsSQL(
    userNotificationConfig,
    metadataVersion
  );

  await readModelDB.transaction(async (tx) => {
    await tx
      .insert(userNotificationConfigInReadmodelNotificationConfig)
      .values(userNotificationConfigSQL);
    if (enabledInAppNotificationsSQL.length > 0) {
      await tx
        .insert(userEnabledInAppNotificationInReadmodelNotificationConfig)
        .values(enabledInAppNotificationsSQL);
    }
    if (enabledEmailNotificationsSQL.length > 0) {
      await tx
        .insert(userEnabledEmailNotificationInReadmodelNotificationConfig)
        .values(enabledEmailNotificationsSQL);
    }
  });
};
