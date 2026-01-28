import { and, eq } from "drizzle-orm";
import { Logger } from "pagopa-interop-commons";
import {
  TenantNotificationConfig,
  TenantNotificationConfigId,
  UserNotificationConfig,
  UserNotificationConfigId,
  UserRole,
  dateToString,
  genericInternalError,
} from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledEmailNotificationInReadmodelNotificationConfig,
  userEnabledInAppNotificationInReadmodelNotificationConfig,
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
        const {
          userNotificationConfigSQL,
          enabledInAppNotificationsSQL,
          enabledEmailNotificationsSQL,
        } = splitUserNotificationConfigIntoObjectsSQL(
          userNotificationConfig,
          metadataVersion
        );
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
    },

    async deleteTenantNotificationConfig(
      tenantNotificationConfigId: TenantNotificationConfigId
    ): Promise<void> {
      await db
        .delete(tenantNotificationConfigInReadmodelNotificationConfig)
        .where(
          eq(
            tenantNotificationConfigInReadmodelNotificationConfig.id,
            tenantNotificationConfigId
          )
        );
    },

    async deleteUserNotificationConfig(
      userNotificationConfigId: UserNotificationConfigId
    ): Promise<void> {
      await db
        .delete(userNotificationConfigInReadmodelNotificationConfig)
        .where(
          eq(
            userNotificationConfigInReadmodelNotificationConfig.id,
            userNotificationConfigId
          )
        );
    },

    async upsertOrMergeUserNotificationConfigOnCreate(
      userNotificationConfig: UserNotificationConfig,
      metadataVersion: number,
      logger: Logger
    ): Promise<void> {
      await db.transaction(async (tx) => {
        // Check for existing record with same userId+tenantId (no id filter)
        const [existingRecord] = await tx
          .select({
            id: userNotificationConfigInReadmodelNotificationConfig.id,
            userRoles:
              userNotificationConfigInReadmodelNotificationConfig.userRoles,
            metadataVersion:
              userNotificationConfigInReadmodelNotificationConfig.metadataVersion,
          })
          .from(userNotificationConfigInReadmodelNotificationConfig)
          .where(
            and(
              eq(
                userNotificationConfigInReadmodelNotificationConfig.userId,
                userNotificationConfig.userId
              ),
              eq(
                userNotificationConfigInReadmodelNotificationConfig.tenantId,
                userNotificationConfig.tenantId
              )
            )
          );

        if (existingRecord) {
          if (existingRecord.id === userNotificationConfig.id) {
            // Same ID - this shouldn't happen for a Created event, raise error
            throw genericInternalError(
              `UserNotificationConfigCreated received for existing id ${userNotificationConfig.id}, userId ${userNotificationConfig.userId}, tenantId ${userNotificationConfig.tenantId}`
            );
          }

          // Different ID - MERGE SCENARIO
          // Merge roles (existing roles + new roles from event)
          const existingRoles = existingRecord.userRoles.map((r) =>
            UserRole.parse(r)
          );
          const mergedRoles = [
            ...new Set([...existingRoles, ...userNotificationConfig.userRoles]),
          ];

          // Log warning: this is a weird/unexpected situation
          logger.warn(
            `UserNotificationConfigCreated received for userId=${userNotificationConfig.userId}, tenantId=${userNotificationConfig.tenantId} but record already exists with different id. Existing id: ${existingRecord.id}, new id: ${userNotificationConfig.id}. Existing roles: [${existingRoles.join(", ")}], new roles: [${userNotificationConfig.userRoles.join(", ")}], merged roles: [${mergedRoles.join(", ")}].`
          );

          // Update ONLY the roles and updatedAt - keep everything else unchanged
          // Don't change metadataVersion
          await tx
            .update(userNotificationConfigInReadmodelNotificationConfig)
            .set({
              userRoles: mergedRoles,
              updatedAt: dateToString(userNotificationConfig.createdAt), // Use the createdAt from the event
            })
            .where(
              eq(
                userNotificationConfigInReadmodelNotificationConfig.id,
                existingRecord.id
              )
            );
        } else {
          // NORMAL CREATE: No existing record, use standard logic
          const shouldUpsert = await checkMetadataVersion(
            tx,
            userNotificationConfigInReadmodelNotificationConfig,
            metadataVersion,
            userNotificationConfig.id
          );
          if (!shouldUpsert) return;

          await tx
            .delete(userNotificationConfigInReadmodelNotificationConfig)
            .where(
              eq(
                userNotificationConfigInReadmodelNotificationConfig.id,
                userNotificationConfig.id
              )
            );

          const {
            userNotificationConfigSQL,
            enabledInAppNotificationsSQL,
            enabledEmailNotificationsSQL,
          } = splitUserNotificationConfigIntoObjectsSQL(
            userNotificationConfig,
            metadataVersion
          );

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
        }
      });
    },
  };
}

export type NotificationConfigReadModelWriteService = ReturnType<
  typeof notificationConfigReadModelWriteServiceBuilder
>;
