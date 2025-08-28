import { and, eq, inArray } from "drizzle-orm";
import { TenantNotificationConfig } from "pagopa-interop-models";
import { WithMetadata } from "pagopa-interop-models";
import {
  Agreement,
  EService,
  EServiceId,
  NotificationConfig,
  Tenant,
  TenantId,
  UserId,
  agreementState,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  CatalogReadModelService,
  NotificationConfigReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  agreementReadModelServiceSQL: AgreementReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  notificationConfigReadModelServiceSQL: NotificationConfigReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
    async getTenantsById(tenantIds: TenantId[]): Promise<Tenant[]> {
      return await readModelDB.transaction(async (tx) =>
        (
          await tenantReadModelServiceSQL.getTenantsByIds(tenantIds, tx)
        ).map((tenantWithMetadata) => tenantWithMetadata.data)
      );
    },
    async getAgreementsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Agreement[] | undefined> {
      return (
        await agreementReadModelServiceSQL.getAgreementsByFilter(
          and(
            eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
              agreementState.pending,
            ])
          )
        )
      ).map((agreement: WithMetadata<Agreement>) => agreement.data);
    },
    async getTenantUsersWithNotificationEnabled(
      tenantIds: TenantId[],
      notificationName: keyof NotificationConfig
    ): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
      return notificationConfigReadModelServiceSQL.getTenantUsersWithNotificationEnabled(
        tenantIds,
        notificationName,
        "email"
      );
    },
    async getTenantNotificationConfigByTenantId(
      tenantId: TenantId
    ): Promise<TenantNotificationConfig | undefined> {
      const notificationConfig =
        await notificationConfigReadModelServiceSQL.getTenantNotificationConfigByTenantId(
          tenantId
        );

      return notificationConfig?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
