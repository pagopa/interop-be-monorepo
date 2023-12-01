import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  agreementState,
  genericError,
  ListResult,
  Tenant,
  WithMetadata,
} from "pagopa-interop-models";
import { Document } from "mongodb";
import { Filter, WithId } from "mongodb";
import { config } from "../utilities/config.js";
const { tenants } = ReadModelRepository.init(config);

function listTenantsFilters(name: string | undefined): object[] {
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
  return [nameFilter, withSelfcareIdFilter];
}

export const getTenants = async ({
  aggregationPipeline,
  offset,
  limit,
  allowDiskUse = false,
}: {
  aggregationPipeline: Document[];
  offset: number;
  limit: number;
  allowDiskUse?: boolean;
}): Promise<{
  results: Tenant[];
  totalCount: number;
}> => {
  const data = await tenants
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }], {
      allowDiskUse,
    })
    .toArray();

  const result = z.array(Tenant).safeParse(data.map((d) => d.data));

  if (!result.success) {
    logger.error(
      `Unable to parse tenants items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw genericError("Unable to parse tenants items");
  }
  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      tenants,
      aggregationPipeline,
      allowDiskUse
    ),
  };
};

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
  async getConsumers({
    name,
    producerId,
    offset,
    limit,
  }: {
    name: string | undefined;
    producerId: string;
    offset: number;
    limit: number;
  }): Promise<ListResult<Tenant>> {
    const query = listTenantsFilters(name);

    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "agreements",
          localField: "data.id",
          foreignField: "data.consumerId",
          as: "agreements",
        },
      },
      {
        $match: {
          $and: [
            { "agreements.data.producerId": producerId },
            {
              "agreements.data.state": {
                $in: [agreementState.active, agreementState.suspended],
              },
            },
          ],
        },
      },
      { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
      { $sort: { lowerName: 1 } },
    ];

    return getTenants({
      aggregationPipeline,
      offset,
      limit,
      allowDiskUse: true,
    });
  },
  async getProducers({
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
      {
        $lookup: {
          from: "eservices",
          localField: "data.id",
          foreignField: "data.producerId",
          as: "eservices",
        },
      },
      { $match: { eservices: { $not: { $size: 0 } } } },
      { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
      { $sort: { lowerName: 1 } },
    ];

    return getTenants({
      aggregationPipeline,
      offset,
      limit,
      allowDiskUse: true,
    });
  },
};
