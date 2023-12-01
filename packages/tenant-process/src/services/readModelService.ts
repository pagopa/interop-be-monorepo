import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  genericError,
  ListResult,
  Tenant,
  WithMetadata,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { config } from "../utilities/config.js";

const { tenants } = ReadModelRepository.init(config);

function listTenantsFilters(
  name: string | undefined
): Filter<{ data: Tenant }> {
  const nameFilter = name
    ? {
        "data.name": {
          $regex: name,
          $options: "i",
        },
      }
    : {};

  const withSelfcareIdFilter = {
    "data.selfcareId": {
      $exists: true,
    },
  };
  return {
    ...nameFilter,
    ...withSelfcareIdFilter,
  };
}

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
  async getTenants({
    name,
    offset,
    limit,
  }: {
    name: string | undefined;
    offset: number;
    limit: number;
  }): Promise<ListResult<Tenant>> {
    const query = listTenantsFilters(name);
    const aggregationPipeline = [
      { $match: query },
      { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
      { $sort: { lowerName: 1 } },
    ];
    const data = await tenants
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(Tenant).safeParse(data.map((d) => d.data));
    if (!result.success) {
      logger.error(
        `Unable to parse tenant items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw genericError("Unable to parse agreements items");
    }

    return {
      results: result.data,
      totalCount: await ReadModelRepository.getTotalCount(
        tenants,
        aggregationPipeline
      ),
    };
  },

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
