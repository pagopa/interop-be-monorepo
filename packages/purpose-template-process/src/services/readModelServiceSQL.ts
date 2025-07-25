import {
  EService,
  EServiceId,
  PurposeTemplate,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { CatalogReadModelService } from "pagopa-interop-readmodel";

export function readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
}: {
  catalogReadModelServiceSQL: CatalogReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getPurposeTemplateById(
      _id: PurposeTemplateId
    ): Promise<PurposeTemplate | undefined> {
      // TO DO: this is a placeholder function Replace with actual implementation to fetch the purpose template by ID
      return undefined;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
