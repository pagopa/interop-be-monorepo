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
