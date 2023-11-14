import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  ErrorTypes,
  WithMetadata,
  Tenant,
  TenantAttribute,
  Attribute,
  ExternalId,
  AttributeNotFound,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../utilities/config.js";

const { tenants, attributes } = ReadModelRepository.init(config);

async function getAttributeByExternalCode(
  code: string,
  origin: string
): Promise<WithMetadata<Attribute>> {
  const data = await attributes.findOne(
    { "data.code": code, "data.origin": origin },
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
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  } else {
    throw AttributeNotFound(`${origin}/${code}`);
  }
}
export const readModelService = {
  async getAttributes(
    attributes: ExternalId[]
  ): Promise<Array<WithMetadata<Attribute>>> {
    const prova = attributes.map((attribute) =>
      getAttributeByExternalCode(attribute.origin, attribute.value)
    );
    return Promise.all(prova);
  },

  async getTenantById(
    tenantId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    const data = await tenants.findOne(
      { "data.id": tenantId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: Tenant,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },

  async getAttributeById(
    attributeId: string
  ): Promise<WithMetadata<TenantAttribute> | undefined> {
    const data = await tenants.findOne(
      { "data.id": attributeId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: TenantAttribute,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse attribute item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },
};
