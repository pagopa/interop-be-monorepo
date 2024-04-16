import { Attribute, AttributeId } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const attributeQueryBuilder = (readModelService: ReadModelService) => ({
  getAttributeById: async (
    attributeId: AttributeId,
    logger: Logger
  ): Promise<Attribute | undefined> =>
    await readModelService.getAttributeById(attributeId, logger),
});

export type AttributeQuery = ReturnType<typeof attributeQueryBuilder>;
