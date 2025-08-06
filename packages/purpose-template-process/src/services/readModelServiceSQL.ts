import {
  EService,
  EServiceId,
  PurposeTemplate,
  PurposeTemplateId,
  WithMetadata,
} from "pagopa-interop-models";
import { CatalogReadModelService } from "pagopa-interop-readmodel";
import { purposeTemplateNotFound } from "../model/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  catalogReadModelServiceSQL,
}: {
  catalogReadModelServiceSQL: CatalogReadModelService;
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
      id: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate>> {
      // TO DO: this is a placeholder function Replace with actual implementation to fetch the purpose template by ID
      throw purposeTemplateNotFound(id);
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
