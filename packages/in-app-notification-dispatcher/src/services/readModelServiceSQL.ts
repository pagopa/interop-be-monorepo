import { and, eq, inArray } from "drizzle-orm";
import {
  Agreement,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  UserId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import {
  AgreementReadModelService,
  CatalogReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import { agreementInReadmodelAgreement } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  agreementReadModelServiceSQL: AgreementReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
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
      ).map((agreement) => agreement.data);
    },
    async getUserNotificationConfigsByTenantIds(
      tenantIds: TenantId[],
      _notificationName: "newEServiceVersionPublished"
    ): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
      // TODO: retrieve info from readmodel
      return tenantIds.map((tenantId) => ({
        userId: generateId<UserId>(),
        tenantId,
      }));
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
