import { EService, EServiceId } from "pagopa-interop-models";
import { CatalogReadModelService } from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
}: {
  catalogReadModelServiceSQL: CatalogReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
