import {
  EServiceId,
  WithMetadata,
  EService,
  TenantId,
  Tenant,
  Agreement,
  agreementState,
} from "pagopa-interop-models";
import {
  CatalogReadModelService,
  TenantReadModelService,
  AgreementReadModelService,
  DelegationReadModelService,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  agreementInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";
import { and, eq, inArray } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
}) {
  return {
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return await catalogReadModelServiceSQL.getEServiceById(id);
    },
    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },
    async getDelegationRelatedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | null> {
      return (
        (
          await agreementReadModelServiceSQL.getAgreementByFilter(
            and(
              eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
              eq(agreementInReadmodelAgreement.consumerId, consumerId),
              inArray(agreementInReadmodelAgreement.state, [
                agreementState.active,
                agreementState.suspended,
                agreementState.pending,
              ])
            )
          )
        )?.data || null
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
