/* 
  This file is incomplete it should be integrated or replaced with development:
  in this PR https://github.com/pagopa/interop-be-monorepo/pull/83
  use method `getAttributeById` will be exposed by readmodelService instead of direct query
*/
import { ReadModelRepository, logger } from "pagopa-interop-commons";
import { Attribute, WithMetadata, genericError } from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../../utilities/config.js";

const { attributes } = ReadModelRepository.init(config);

export const attributesQuery = {
  getAttributeById: async (
    attributeId: string
  ): Promise<WithMetadata<Attribute> | undefined> => {
    const data = await attributes.findOne(
      { "data.id": attributeId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: Attribute,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse attribute item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse attribute item");
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },
};
