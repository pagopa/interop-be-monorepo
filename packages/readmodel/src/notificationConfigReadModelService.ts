import { match } from "ts-pattern";
import {
  NotificationType,
  TenantId,
  TenantNotificationConfig,
  UserId,
  UserNotificationConfig,
  WithMetadata,
  emailNotificationPreference,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledInAppNotificationInReadmodelNotificationConfig,
  userEnabledEmailNotificationInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { and, eq, inArray } from "drizzle-orm";
import {
  aggregateTenantNotificationConfig,
  aggregateUserNotificationConfig,
  toUserNotificationConfigAggregator,
} from "./notification-config/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigReadModelServiceBuilder(
  db: DrizzleReturnType
) {
  return {
    async getTenantNotificationConfigByTenantId(
      tenantId: TenantId
    ): Promise<WithMetadata<TenantNotificationConfig> | undefined> {
      const queryResult = await db
        .select()
        .from(tenantNotificationConfigInReadmodelNotificationConfig)
        .where(
          eq(
            tenantNotificationConfigInReadmodelNotificationConfig.tenantId,
            tenantId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateTenantNotificationConfig(queryResult[0]);
    },

    async getUserNotificationConfigByUserIdAndTenantId(
      userId: UserId,
      tenantId: TenantId
    ): Promise<WithMetadata<UserNotificationConfig> | undefined> {
      const queryResult = await db
        .select({
          userNotificationConfig:
            userNotificationConfigInReadmodelNotificationConfig,
          enabledInAppNotification:
            userEnabledInAppNotificationInReadmodelNotificationConfig,
          enabledEmailNotification:
            userEnabledEmailNotificationInReadmodelNotificationConfig,
        })
        .from(userNotificationConfigInReadmodelNotificationConfig)
        .where(
          and(
            eq(
              userNotificationConfigInReadmodelNotificationConfig.userId,
              userId
            ),
            eq(
              userNotificationConfigInReadmodelNotificationConfig.tenantId,
              tenantId
            )
          )
        )
        .leftJoin(
          userEnabledInAppNotificationInReadmodelNotificationConfig,
          eq(
            userNotificationConfigInReadmodelNotificationConfig.id,
            userEnabledInAppNotificationInReadmodelNotificationConfig.userNotificationConfigId
          )
        )
        .leftJoin(
          userEnabledEmailNotificationInReadmodelNotificationConfig,
          eq(
            userNotificationConfigInReadmodelNotificationConfig.id,
            userEnabledEmailNotificationInReadmodelNotificationConfig.userNotificationConfigId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateUserNotificationConfig(
        toUserNotificationConfigAggregator(queryResult)
      );
    },

    async getTenantUsersWithNotificationEnabled(
      tenantIds: TenantId[],
      notificationType: NotificationType,
      notificationChannel: "inApp" | "email"
    ): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
      const enabledNotificationTable = match(notificationChannel)
        .with(
          "inApp",
          () => userEnabledInAppNotificationInReadmodelNotificationConfig
        )
        .with(
          "email",
          () => userEnabledEmailNotificationInReadmodelNotificationConfig
        )
        .exhaustive();

      const queryResult = await db
        .select({
          userId: userNotificationConfigInReadmodelNotificationConfig.userId,
          tenantId:
            userNotificationConfigInReadmodelNotificationConfig.tenantId,
        })
        .from(userNotificationConfigInReadmodelNotificationConfig)
        .innerJoin(
          enabledNotificationTable,
          eq(
            userNotificationConfigInReadmodelNotificationConfig.id,
            enabledNotificationTable.userNotificationConfigId
          )
        )
        .where(
          and(
            inArray(
              userNotificationConfigInReadmodelNotificationConfig.tenantId,
              tenantIds
            ),
            eq(enabledNotificationTable.notificationType, notificationType),
            match(notificationChannel)
              .with(
                "inApp",
                () =>
                  userNotificationConfigInReadmodelNotificationConfig.inAppNotificationPreference
              )
              .with("email", () =>
                eq(
                  userNotificationConfigInReadmodelNotificationConfig.emailNotificationPreference,
                  emailNotificationPreference.enabled
                )
              )
              .exhaustive()
          )
        );

      return queryResult.map((row) => ({
        userId: unsafeBrandId(row.userId),
        tenantId: unsafeBrandId(row.tenantId),
      }));
    },
  };
}

export type NotificationConfigReadModelService = ReturnType<
  typeof notificationConfigReadModelServiceBuilder
>;
