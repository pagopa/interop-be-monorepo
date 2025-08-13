import {
  EService,
  EServiceId,
  PurposeTemplate,
  PurposeTemplateId,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
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
    async checkPurposeTemplateName(): Promise<boolean> {
      return false;
    },
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getPurposeTemplateById(
      _id: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      // TO DO: this is a placeholder function Replace with actual implementation to fetch the purpose template by ID
      return undefined;
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
