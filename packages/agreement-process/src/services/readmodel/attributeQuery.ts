/* 
  This file is incomplete it should be integrated or replaced with development:
  in this PR https://github.com/pagopa/interop-be-monorepo/pull/83
  use method `getAttributeById` will be exposed by readmodelService instead of direct query
*/
import { Attribute, WithMetadata } from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const attributeQueryBuilder = (readModelService: ReadModelService) => ({
  getAttributeById: async (
    attributeId: string
  ): Promise<WithMetadata<Attribute> | undefined> =>
    await readModelService.getAttributeById(attributeId),
});

export type AttributeQuery = ReturnType<typeof attributeQueryBuilder>;
