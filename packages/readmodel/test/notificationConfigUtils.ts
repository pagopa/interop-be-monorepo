import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { notificationConfigReadModelServiceBuilder } from "../src/notificationConfigReadModelService.js";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "../src/notification-config/splitters.js";
import { readModelDB } from "./utils.js";

export const notificationConfigReadModelService =
  notificationConfigReadModelServiceBuilder(readModelDB);

export const insertTenantNotificationConfig = async (
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
