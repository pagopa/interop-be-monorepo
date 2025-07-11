import { eq } from "drizzle-orm";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  tenantEnabledNotificationInReadmodelNotificationConfig,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledNotificationInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigReadModelWriteServiceBuilder(
  db: DrizzleReturnType
) {
  return {
    async upsertTenantNotificationConfig(
      tenantNotificationConfig: TenantNotificationConfig,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          tenantNotificationConfigInReadmodelNotificationConfig,
          metadataVersion,
          tenantNotificationConfig.id
        );
        if (!shouldUpsert) {
          return;
        }
        await tx
          .delete(tenantNotificationConfigInReadmodelNotificationConfig)
          .where(
            eq(
              tenantNotificationConfigInReadmodelNotificationConfig.id,
              tenantNotificationConfig.id
            )
          );
        const { tenantNotificationConfigSQL, enabledNotificationsSQL } =
          splitTenantNotificationConfigIntoObjectsSQL(
            tenantNotificationConfig,
            metadataVersion
          );
        await tx
          .insert(tenantNotificationConfigInReadmodelNotificationConfig)
          .values(tenantNotificationConfigSQL);
        if (enabledNotificationsSQL.length > 0) {
          await tx
            .insert(tenantEnabledNotificationInReadmodelNotificationConfig)
            .values(enabledNotificationsSQL);
        }
      });
    },

    async upsertUserNotificationConfig(
      userNotificationConfig: UserNotificationConfig,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          userNotificationConfigInReadmodelNotificationConfig,
          metadataVersion,
          userNotificationConfig.id
        );
        if (!shouldUpsert) {
          return;
        }
        await tx
          .delete(userNotificationConfigInReadmodelNotificationConfig)
          .where(
            eq(
              userNotificationConfigInReadmodelNotificationConfig.id,
              userNotificationConfig.id
            )
          );
        const { userNotificationConfigSQL, enabledNotificationsSQL } =
          splitUserNotificationConfigIntoObjectsSQL(
            userNotificationConfig,
            metadataVersion
          );
        await tx
          .insert(userNotificationConfigInReadmodelNotificationConfig)
          .values(userNotificationConfigSQL);
        if (enabledNotificationsSQL.length > 0) {
          await tx
            .insert(userEnabledNotificationInReadmodelNotificationConfig)
            .values(enabledNotificationsSQL);
        }
      });
    },
  };
}

export type NotificationConfigReadModelWriteService = ReturnType<
  typeof notificationConfigReadModelWriteServiceBuilder
>;
