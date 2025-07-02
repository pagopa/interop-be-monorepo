import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantNotificationConfigInReadmodelNotificationConfig,
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
  await readModelDB
    .insert(tenantNotificationConfigInReadmodelNotificationConfig)
    .values(
      splitTenantNotificationConfigIntoObjectsSQL(
        tenantNotificationConfig,
        metadataVersion
      )
    );
};

export const insertUserNotificationConfig = async (
  readModelDB: DrizzleReturnType,
  userNotificationConfig: UserNotificationConfig,
  metadataVersion: number
): Promise<void> => {
  await readModelDB
    .insert(userNotificationConfigInReadmodelNotificationConfig)
    .values(
      splitUserNotificationConfigIntoObjectsSQL(
        userNotificationConfig,
        metadataVersion
      )
    );
};
