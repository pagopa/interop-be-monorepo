import {
  NotificationConfig,
  TenantId,
  TenantNotificationConfig,
  UserId,
  UserNotificationConfig,
  WithMetadata,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantEnabledNotificationInReadmodelNotificationConfig,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userEnabledNotificationInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { and, eq, inArray } from "drizzle-orm";
import {
  aggregateTenantNotificationConfig,
  aggregateUserNotificationConfig,
  toTenantNotificationConfigAggregator,
  toUserNotificationConfigAggregator,
} from "./notification-config/aggregators.js";
import { UserNotificationType } from "./notification-config/utils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigReadModelServiceBuilder(
  db: DrizzleReturnType
) {
  return {
    async getTenantNotificationConfigByTenantId(
      tenantId: TenantId
    ): Promise<WithMetadata<TenantNotificationConfig> | undefined> {
      const queryResult = await db
        .select({
          tenantNotificationConfig:
            tenantNotificationConfigInReadmodelNotificationConfig,
          enabledNotification:
            tenantEnabledNotificationInReadmodelNotificationConfig,
        })
        .from(tenantNotificationConfigInReadmodelNotificationConfig)
        .where(
          eq(
            tenantNotificationConfigInReadmodelNotificationConfig.tenantId,
            tenantId
          )
        )
        .leftJoin(
          tenantEnabledNotificationInReadmodelNotificationConfig,
          eq(
            tenantNotificationConfigInReadmodelNotificationConfig.id,
            tenantEnabledNotificationInReadmodelNotificationConfig.tenantNotificationConfigId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateTenantNotificationConfig(
        toTenantNotificationConfigAggregator(queryResult)
      );
    },

    async getUserNotificationConfigByUserIdAndTenantId(
      userId: UserId,
      tenantId: TenantId
    ): Promise<WithMetadata<UserNotificationConfig> | undefined> {
      const queryResult = await db
        .select({
          userNotificationConfig:
            userNotificationConfigInReadmodelNotificationConfig,
          enabledNotification:
            userEnabledNotificationInReadmodelNotificationConfig,
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
          userEnabledNotificationInReadmodelNotificationConfig,
          eq(
            userNotificationConfigInReadmodelNotificationConfig.id,
            userEnabledNotificationInReadmodelNotificationConfig.userNotificationConfigId
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
      notificationType: keyof NotificationConfig,
      notificationChannel: "inApp" | "email"
    ): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
      const userNotificationType: UserNotificationType = `${notificationType}.${notificationChannel}`;
      const queryResult = await db
        .select({
          userId: userNotificationConfigInReadmodelNotificationConfig.userId,
          tenantId:
            userNotificationConfigInReadmodelNotificationConfig.tenantId,
        })
        .from(userNotificationConfigInReadmodelNotificationConfig)
        .innerJoin(
          userEnabledNotificationInReadmodelNotificationConfig,
          eq(
            userNotificationConfigInReadmodelNotificationConfig.id,
            userEnabledNotificationInReadmodelNotificationConfig.userNotificationConfigId
          )
        )
        .where(
          and(
            inArray(
              userNotificationConfigInReadmodelNotificationConfig.tenantId,
              tenantIds
            ),
            eq(
              userEnabledNotificationInReadmodelNotificationConfig.notificationType,
              userNotificationType
            )
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
