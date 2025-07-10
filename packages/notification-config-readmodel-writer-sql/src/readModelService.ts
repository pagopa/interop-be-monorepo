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
  tenantNotificationConfigInReadmodelNotificationConfig,
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
        const tenantNotificationConfigSQL =
          splitTenantNotificationConfigIntoObjectsSQL(
            tenantNotificationConfig,
            metadataVersion
          );
        await tx
          .insert(tenantNotificationConfigInReadmodelNotificationConfig)
          .values(tenantNotificationConfigSQL);
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
        const userNotificationConfigSQL =
          splitUserNotificationConfigIntoObjectsSQL(
            userNotificationConfig,
            metadataVersion
          );
        await tx
          .insert(userNotificationConfigInReadmodelNotificationConfig)
          .values(userNotificationConfigSQL);
      });
    },
  };
}

export type NotificationConfigReadModelWriteService = ReturnType<
  typeof notificationConfigReadModelWriteServiceBuilder
>;
