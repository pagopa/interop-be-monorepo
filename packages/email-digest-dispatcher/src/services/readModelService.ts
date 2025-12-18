import {
  eq,
  sql,
  desc,
  asc,
  and,
  gte,
  isNotNull,
  count,
  inArray,
} from "drizzle-orm";
import { withTotalCount } from "pagopa-interop-commons";
import {
  TenantId,
  UserId,
  UserRole,
  unsafeBrandId,
  EServiceId,
  DescriptorId,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  userNotificationConfigInReadmodelNotificationConfig,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  agreementInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";

const TIME_INTERVAL_IN_DAYS = 7;

export type DigestUser = {
  userId: UserId;
  tenantId: TenantId;
  userRoles: UserRole[];
};

export type NewEservice = {
  eserviceId: EServiceId;
  eserviceDescriptorId: DescriptorId;
  eserviceName: string;
  agreementCount: number;
  totalCount: number;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getNewEservices(
      priorityProducerIds: TenantId[]
    ): Promise<NewEservice[]> {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - TIME_INTERVAL_IN_DAYS);
      const priorityField = inArray(
        eserviceInReadmodelCatalog.producerId,
        priorityProducerIds
      );

      const results = await db
        .select(
          withTotalCount({
            eserviceId: eserviceInReadmodelCatalog.id,
            eserviceDescriptorId: eserviceDescriptorInReadmodelCatalog.id,
            eserviceName: eserviceInReadmodelCatalog.name,
            agreementCount: count(agreementInReadmodelAgreement.id).as(
              "agreementCount"
            ),
          })
        )
        .from(eserviceDescriptorInReadmodelCatalog)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          agreementInReadmodelAgreement,
          eq(
            eserviceInReadmodelCatalog.id,
            agreementInReadmodelAgreement.eserviceId
          )
        )
        .where(
          and(
            eq(eserviceDescriptorInReadmodelCatalog.state, "Published"),
            gte(
              eserviceDescriptorInReadmodelCatalog.publishedAt,
              dateThreshold.toISOString()
            ),
            isNotNull(eserviceDescriptorInReadmodelCatalog.publishedAt)
          )
        )
        .groupBy(
          eserviceInReadmodelCatalog.id,
          eserviceDescriptorInReadmodelCatalog.id,
          eserviceDescriptorInReadmodelCatalog.publishedAt,
          eserviceInReadmodelCatalog.name,
          eserviceInReadmodelCatalog.producerId
        )
        .orderBy(
          desc(priorityField),
          desc(count(agreementInReadmodelAgreement.id)),
          asc(eserviceDescriptorInReadmodelCatalog.publishedAt)
        )
        .limit(5);

      return results.map((row) => ({
        eserviceId: unsafeBrandId<EServiceId>(row.eserviceId),
        eserviceDescriptorId: unsafeBrandId<DescriptorId>(
          row.eserviceDescriptorId
        ),
        eserviceName: row.eserviceName,
        agreementCount: row.agreementCount,
        totalCount: row.totalCount,
      }));
    },

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
          eq(
            userNotificationConfigInReadmodelNotificationConfig.emailNotificationPreference,
            true
          )
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
