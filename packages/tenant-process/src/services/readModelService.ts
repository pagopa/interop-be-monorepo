import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { genericError, WithMetadata } from "pagopa-interop-models";
import { Tenant } from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { config } from "../utilities/config.js";
const { tenants } = ReadModelRepository.init(config);

async function getTenant(
  filter: Filter<WithId<WithMetadata<Tenant>>>
): Promise<WithMetadata<Tenant> | undefined> {
  const dataTenant = await tenants.findOne(filter, {
    projection: { dataTenant: true, metadata: true },
  });

  if (dataTenant) {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Tenant,
      })
      .safeParse(dataTenant);
    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(dataTenant)} `
      );
      throw genericError("Unable to parse tenant item");
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
  return undefined;
}

export const readModelService = {
  async getTenantById(id: string): Promise<WithMetadata<Tenant> | undefined> {
    return getTenant({ "data.id": id });
  },

  async getTenantByExternalId({
    origin,
    code,
  }: {
    origin: string;
    code: string;
  }): Promise<WithMetadata<Tenant> | undefined> {
    return getTenant({
      "data.externalId.value": code,
      "data.externalId.origin": origin,
    });
  },

  async getTenantBySelfcareId(
    selfcareId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    return getTenant({ "data.selfcareId": selfcareId });
  },
};
