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
import {
  purposeTemplateNameConflict,
  purposeTemplateNotFound,
} from "../model/domain/errors.js";
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
    async getPurposeTemplate(
      _title: string
    ): Promise<WithMetadata<PurposeTemplate>> {
      // TODO : this is a placeholder function to replace with properly implementation
      throw purposeTemplateNameConflict();
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getPurposeTemplateById(
      id: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate>> {
      // TO DO: this is a placeholder function Replace with actual implementation to fetch the purpose template by ID
      throw purposeTemplateNotFound(id);
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
