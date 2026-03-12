import { EService, EServiceId, Tenant, TenantId } from "pagopa-interop-models";
import {
  CatalogReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
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
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
