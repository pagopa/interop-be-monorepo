import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  NotificationConfigEvent,
  TenantNotificationConfig,
  UserNotificationConfig,
  TenantNotificationConfigId,
  UserNotificationConfigId,
  toTenantNotificationConfigV2,
  toUserNotificationConfigV2,
} from "pagopa-interop-models";
import {
  notificationConfigReadModelServiceBuilder,
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { inject, afterEach } from "vitest";
import { notificationConfigServiceBuilder } from "../src/services/notificationConfigService.js";

export const { cleanup, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const notificationConfigReadModelService =
  notificationConfigReadModelServiceBuilder(readModelDB);

export const notificationConfigService = notificationConfigServiceBuilder(
  postgresDB,
  notificationConfigReadModelService
);

export const readLastNotificationConfigEvent = async (
  id: TenantNotificationConfigId | UserNotificationConfigId
): Promise<ReadEvent<NotificationConfigEvent>> =>
  await readLastEventByStreamId(id, "notification_config", postgresDB);

const writeTenantNotificationConfigInEventstore = async (
  tenantNotificationConfig: TenantNotificationConfig
): Promise<void> => {
  const event: NotificationConfigEvent = {
    type: "TenantNotificationConfigUpdated",
    event_version: 2,
    data: {
      tenantNotificationConfig: toTenantNotificationConfigV2(
        tenantNotificationConfig
      ),
    },
  };
  const eventToWrite: StoredEvent<NotificationConfigEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: event.data.tenantNotificationConfig!.id,
    version: 0,
    event,
  };
  await writeInEventstore(eventToWrite, "notification_config", postgresDB);
};

export const addOneTenantNotificationConfig = async (
  tenantNotificationConfig: TenantNotificationConfig
): Promise<void> => {
  writeTenantNotificationConfigInEventstore(tenantNotificationConfig);
  await readModelDB
    .insert(tenantNotificationConfigInReadmodelNotificationConfig)
    .values(
      splitTenantNotificationConfigIntoObjectsSQL(tenantNotificationConfig, 0)
    );
};

const writeUserNotificationConfigInEventstore = async (
  userNotificationConfig: UserNotificationConfig
): Promise<void> => {
  const event: NotificationConfigEvent = {
    type: "UserNotificationConfigUpdated",
    event_version: 2,
    data: {
      userNotificationConfig: toUserNotificationConfigV2(
        userNotificationConfig
      ),
    },
  };
  const eventToWrite: StoredEvent<NotificationConfigEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: event.data.userNotificationConfig!.id,
    version: 0,
    event,
  };
  await writeInEventstore(eventToWrite, "notification_config", postgresDB);
};

export const addOneUserNotificationConfig = async (
  userNotificationConfig: UserNotificationConfig
): Promise<void> => {
  writeUserNotificationConfigInEventstore(userNotificationConfig);
  await readModelDB
    .insert(userNotificationConfigInReadmodelNotificationConfig)
    .values(
      splitUserNotificationConfigIntoObjectsSQL(userNotificationConfig, 0)
    );
};
