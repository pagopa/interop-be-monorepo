import {
  PurposeTemplate,
  PurposeTemplateId,
  WithMetadata,
} from "pagopa-interop-models";
import { DrizzleReturnType } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateReadModelServiceBuilder(_db: DrizzleReturnType) {
  return {
    async getPurposeTemplateById(
      _purposeTemplateId: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return undefined;
    },
  };
}

export type PurposeTemplateReadModelService = ReturnType<
  typeof purposeTemplateReadModelServiceBuilder
>;
