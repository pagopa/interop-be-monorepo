import {
  TenantId,
  UserId,
  UserRole,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { eq } from "drizzle-orm";

export type DigestUser = {
  userId: UserId;
  tenantId: TenantId;
  userRoles: UserRole[];
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: DrizzleReturnType) {
  return {
    /**
     * Returns all users who have email notification preference set to "Digest"
     */
    async getUsersWithDigestPreference(): Promise<DigestUser[]> {
      const queryResult = await db
        .select({
          userId: userNotificationConfigInReadmodelNotificationConfig.userId,
          tenantId:
            userNotificationConfigInReadmodelNotificationConfig.tenantId,
          userRoles:
            userNotificationConfigInReadmodelNotificationConfig.userRoles,
        })
        .from(userNotificationConfigInReadmodelNotificationConfig)
        .where(
          userNotificationConfigInReadmodelNotificationConfig.emailNotificationPreference
        );

      return queryResult.map((row) => ({
        userId: unsafeBrandId<UserId>(row.userId),
        tenantId: unsafeBrandId<TenantId>(row.tenantId),
        userRoles: row.userRoles.map((r) => UserRole.parse(r)),
      }));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
