import {
  TenantId,
  TenantNotificationConfig,
  UserId,
  UserNotificationConfig,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantNotificationConfigInReadmodelNotificationConfig,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { and, eq } from "drizzle-orm";
import {
  aggregateTenantNotificationConfig,
  aggregateUserNotificationConfig,
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
        .select()
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
        );
      if (queryResult.length === 0) {
        return undefined;
      }
      return aggregateUserNotificationConfig(queryResult[0]);
    },
  };
}

export type NotificationConfigReadModelService = ReturnType<
  typeof notificationConfigReadModelServiceBuilder
>;
