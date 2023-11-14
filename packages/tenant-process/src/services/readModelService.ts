import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  ErrorTypes,
  WithMetadata,
  Tenant,
  TenantAttribute,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../utilities/config.js";

const { tenants, attributes } = ReadModelRepository.init(config);

export const readModelService = {
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
