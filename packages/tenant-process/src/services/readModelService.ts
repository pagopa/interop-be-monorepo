import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  agreementState,
  ErrorTypes,
  ListResult,
  Tenant,
} from "pagopa-interop-models";
import { Document } from "mongodb";
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
}: {
  aggregationPipeline: Document[];
  offset: number;
  limit: number;
}): Promise<{
  results: Tenant[];
  totalCount: number;
}> => {
  const data = await tenants
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
    .toArray();

  const result = z.array(Tenant).safeParse(data.map((d) => d.data));

  if (!result.success) {
    logger.error(
      `Unable to parse tenants items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }
  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      tenants,
      aggregationPipeline
    ),
  };
};

export const readModelService = {
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

    return getTenants({ aggregationPipeline, offset, limit });
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

    return getTenants({ aggregationPipeline, offset, limit });
  },
};
